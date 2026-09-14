-- ============================================================================
-- Snake Thai — Controle de frequência, Fase 1: fundação de dados
-- ----------------------------------------------------------------------------
-- Especificação e decisões em docs/FREQUENCIA.md. Esta migration só cria a
-- ESTRUTURA e as travas de integridade; o cálculo da frequência, o fechamento
-- mensal e o aviso de aula sem chamada vêm na Fase 2.
--
-- Nota de fuso: o banco roda em UTC. "Aula já ocorrida" e a virada do mês
-- precisam ser avaliadas em America/Sao_Paulo — responsabilidade das funções
-- da Fase 2, não das colunas daqui (que guardam instantes, sem ambiguidade).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Declaração do aluno × chamada do professor
--
--    A regra do cliente: "a presença só é efetivada com a chamada do
--    professor; o que o aluno marca é apenas sugestivo". Uma única coluna não
--    distingue as duas coisas, então elas se separam:
--      · declared_status — o que o ALUNO disse que faria (sugestivo);
--      · status          — o que o PROFESSOR registrou na chamada (oficial).
-- ----------------------------------------------------------------------------
alter table public.attendance add column declared_status public.attendance_status;

comment on column public.attendance.declared_status is
  'Declaração do próprio aluno (vou / não vou). Apenas sugestiva: não conta '
  'como presença nem como falta.';
comment on column public.attendance.status is
  'Chamada do professor (ou admin). É a ÚNICA fonte oficial de presença.';

-- Os registros existentes nasceram de alunos respondendo no app: eram
-- declarações. Movê-los para declared_status e zerar status é coerente com a
-- decisão "aula sem chamada sai da conta" — nenhuma dessas aulas teve chamada
-- concluída, porque o conceito não existia.
update public.attendance
   set declared_status = status,
       status = null
 where status is not null;

-- Trava: sem isto, a policy de UPDATE ("próprio aluno") deixaria o aluno
-- alterar QUALQUER coluna da própria linha — inclusive se autoconfirmar
-- presente. Mesmo padrão de whitelist de payments (C-3). [#55]
create or replace function public.enforce_attendance_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  colunas_do_aluno constant text[] := array['declared_status', 'updated_at'];
  v_gestor boolean;
  coluna text;
begin
  -- Contexto de sistema (cron, service_role).
  if (select auth.uid()) is null then
    return new;
  end if;

  v_gestor := public.is_admin() or exists (
    select 1 from public.class_teachers ct
     where ct.class_id = new.class_id
       and ct.teacher_id = (select auth.uid())
  );
  if v_gestor then
    return new;
  end if;

  -- Daqui para baixo: quem não gerencia a aula (na prática, o próprio aluno;
  -- qualquer outro já é barrado pela RLS).
  if tg_op = 'INSERT' then
    if new.status is not null then
      raise exception 'Operação negada: a presença só é confirmada pela chamada do professor.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  for coluna in select jsonb_object_keys(to_jsonb(new)) loop
    if (to_jsonb(old) -> coluna) is distinct from (to_jsonb(new) -> coluna)
       and not (coluna = any (colunas_do_aluno)) then
      raise exception
        'Operação negada: o aluno só altera a própria declaração (coluna "%").', coluna
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$funcao$;

create trigger trg_attendance_enforce_rules
  before insert or update on public.attendance
  for each row execute function public.enforce_attendance_rules();

-- ----------------------------------------------------------------------------
-- 2. Marca de chamada concluída
--
--    É o campo que viabiliza a decisão "aula sem chamada sai da conta": sem
--    ele, "aula sem chamada" e "aula em que todos faltaram" são indistinguíveis.
--    Quem pode preenchê-lo (e a regra de não marcar aula futura) vem na Fase 2,
--    via função — a policy de UPDATE de classes é exclusiva do admin.
-- ----------------------------------------------------------------------------
alter table public.classes add column attendance_taken_at timestamptz;

comment on column public.classes.attendance_taken_at is
  'Quando a chamada foi concluída. Nulo = aula sem chamada: não entra no '
  'cálculo de frequência de ninguém.';

-- ----------------------------------------------------------------------------
-- 3. Justificativa de falta
-- ----------------------------------------------------------------------------
create type public.justification_status as enum ('pending', 'approved', 'rejected');

create table public.absence_justifications (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid not null references public.classes (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  message         text,
  proof_provider  public.media_provider,
  proof_public_id text,
  status          public.justification_status not null default 'pending',
  reviewed_by     uuid references public.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Uma justificativa por aluno por aula.
  constraint absence_justifications_unica_por_aula unique (class_id, user_id),
  -- O limite vive no banco, não só na tela: outro cliente da API não o burla.
  constraint absence_justifications_mensagem_limite
    check (message is null or char_length(message) <= 255),
  -- Justificativa vazia não justifica nada.
  constraint absence_justifications_tem_conteudo
    check (nullif(btrim(coalesce(message, '')), '') is not null or proof_public_id is not null),
  constraint absence_justifications_anexo_coerente
    check ((proof_provider is null) = (proof_public_id is null)),
  -- reviewed_by pode ficar nulo se o revisor for excluído (SET NULL); o
  -- carimbo de tempo é o que prova que houve revisão.
  constraint absence_justifications_revisao_coerente
    check ((status = 'pending') = (reviewed_at is null))
);

comment on table public.absence_justifications is
  'Justificativa de falta. Aprovada, NÃO conta como presença, mas tira a aula '
  'do denominador da frequência do aluno.';

create index idx_absence_justifications_user on public.absence_justifications (user_id);
create index idx_absence_justifications_pendentes
  on public.absence_justifications (class_id) where status = 'pending';

create trigger trg_absence_justifications_set_updated_at
  before update on public.absence_justifications
  for each row execute function public.handle_updated_at();

-- Regras por papel. A RLS decide QUEM toca a linha; este gatilho decide O QUE
-- cada um pode mudar nela — RLS é por linha, não por coluna.
create or replace function public.enforce_absence_justification_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_uid     uuid := (select auth.uid());
  v_revisor boolean;
begin
  if v_uid is null then
    return new;
  end if;

  v_revisor := public.is_admin() or exists (
    select 1 from public.class_teachers ct
     where ct.class_id = new.class_id
       and ct.teacher_id = v_uid
  );

  if tg_op = 'INSERT' then
    if public.is_admin() then
      return new;
    end if;
    if new.status <> 'pending' or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'Operação negada: justificativa nasce pendente de revisão.'
        using errcode = '42501';
    end if;
    -- A justificativa acompanha a declaração de ausência ("caso ele marque
    -- que não irá"). Sem declaração, não há o que justificar.
    if not exists (
      select 1 from public.attendance a
       where a.class_id = new.class_id
         and a.user_id = new.user_id
         and a.declared_status = 'absent'
    ) then
      raise exception 'Justificativa só pode ser enviada para uma aula em que o aluno declarou ausência.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  -- UPDATE --------------------------------------------------------------------
  if new.class_id is distinct from old.class_id or new.user_id is distinct from old.user_id then
    raise exception 'Operação negada: a justificativa não muda de aula nem de aluno.'
      using errcode = '42501';
  end if;

  if v_revisor then
    -- Quem revisa decide o status, mas não reescreve o que o aluno enviou.
    if new.message is distinct from old.message
       or new.proof_provider is distinct from old.proof_provider
       or new.proof_public_id is distinct from old.proof_public_id then
      raise exception 'Operação negada: quem revisa não altera o conteúdo da justificativa.'
        using errcode = '42501';
    end if;
    -- Carimbo automático: o revisor não escolhe em nome de quem aprovou.
    if new.status is distinct from old.status then
      if new.status = 'pending' then
        new.reviewed_by := null;
        new.reviewed_at := null;
      else
        new.reviewed_by := v_uid;
        new.reviewed_at := now();
      end if;
    else
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
    end if;
    return new;
  end if;

  -- Dono (o próprio aluno): edita o conteúdo só enquanto pendente.
  if new.status is distinct from old.status
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'Operação negada: o aluno não revisa a própria justificativa.'
      using errcode = '42501';
  end if;
  if old.status <> 'pending' then
    raise exception 'Operação negada: justificativa já revisada não pode ser alterada.'
      using errcode = '42501';
  end if;

  return new;
end;
$funcao$;

create trigger trg_absence_justifications_enforce_rules
  before insert or update on public.absence_justifications
  for each row execute function public.enforce_absence_justification_rules();

-- RLS
alter table public.absence_justifications enable row level security;

create policy "absence_justifications_select_own_admin_or_teacher"
  on public.absence_justifications for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
       where ct.class_id = absence_justifications.class_id
         and ct.teacher_id = (select auth.uid())
    )
  );

create policy "absence_justifications_insert_own_or_admin"
  on public.absence_justifications for insert to authenticated
  with check ((select auth.uid()) = user_id or public.is_admin());

create policy "absence_justifications_update_own_admin_or_teacher"
  on public.absence_justifications for update to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
       where ct.class_id = absence_justifications.class_id
         and ct.teacher_id = (select auth.uid())
    )
  );

-- O aluno pode desistir de uma justificativa ainda não revisada; revisada,
-- ela vira registro e só o admin remove.
create policy "absence_justifications_delete_own_pending_or_admin"
  on public.absence_justifications for delete to authenticated
  using (
    ((select auth.uid()) = user_id and status = 'pending')
    or public.is_admin()
  );

grant select, insert, update, delete on public.absence_justifications to authenticated;
-- service_role ignora a RLS, mas não os GRANTs — a falta deles já derrubou
-- payments em produção (20260901120000). Não repetir.
grant select, insert, update, delete on public.absence_justifications to service_role;

-- ----------------------------------------------------------------------------
-- 4. Anexo da justificativa na fila de eliminação (LGPD)
--
--    Reusa a fila dos comprovantes em vez de inventar um segundo mecanismo: o
--    worker que apaga mídia da Cloudinary continua sendo um só.
-- ----------------------------------------------------------------------------
alter table public.media_deletion_queue
  add column justification_id uuid references public.absence_justifications (id) on delete set null;

create or replace function public.enfileirar_exclusao_de_anexo_justificativa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
begin
  if old.proof_public_id is null then
    return coalesce(new, old);
  end if;
  -- Em UPDATE, só interessa quando o anexo foi TROCADO ou REMOVIDO.
  if tg_op = 'UPDATE' and new.proof_public_id is not distinct from old.proof_public_id then
    return new;
  end if;

  insert into public.media_deletion_queue (provider, asset_ref, justification_id, motivo)
  values (
    old.proof_provider,
    old.proof_public_id,
    -- Em DELETE a linha já não existe: referenciá-la violaria a FK.
    case when tg_op = 'DELETE' then null else old.id end,
    'justificativa_removida'
  );

  return coalesce(new, old);
end;
$funcao$;

create trigger trg_absence_justifications_enfileirar_anexo
  after update or delete on public.absence_justifications
  for each row execute function public.enfileirar_exclusao_de_anexo_justificativa();

-- ----------------------------------------------------------------------------
-- 5. Histórico mensal congelado
--
--    Decisão: "fecha o mês e congela". Nenhuma policy de escrita para
--    authenticated — só a função de fechamento (Fase 2, security definer)
--    grava aqui. Assim o passado não muda nem se alguém editar uma chamada
--    antiga.
-- ----------------------------------------------------------------------------
create table public.attendance_monthly (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  reference_month   date not null,
  -- `text`, não uuid: groups.id é texto legível ('turma-manha'); o ensaio
  -- desta migration falhou exatamente por assumir uuid aqui.
  group_id          text references public.groups (id) on delete set null,
  total_classes     integer not null,  -- aulas de rotina da turma no mês (o "12" do contador)
  counted_classes   integer not null,  -- dessas, as que tiveram chamada concluída
  attended          integer not null,  -- presenças confirmadas pelo professor
  justified         integer not null,  -- faltas com justificativa aprovada
  frequency_percent numeric(5, 2) not null,
  closed_at         timestamptz not null default now(),

  constraint attendance_monthly_unico_por_mes unique (user_id, reference_month),
  constraint attendance_monthly_mes_dia_um
    check (reference_month = date_trunc('month', reference_month)::date),
  constraint attendance_monthly_contagens_coerentes
    check (
      total_classes >= 0
      and counted_classes between 0 and total_classes
      and attended >= 0
      and justified >= 0
      and attended + justified <= counted_classes
    ),
  constraint attendance_monthly_percentual_valido
    check (frequency_percent between 0 and 100)
);

comment on table public.attendance_monthly is
  'Frequência mensal CONGELADA no fechamento do mês. Regras de cálculo em '
  'docs/FREQUENCIA.md.';

alter table public.attendance_monthly enable row level security;

-- Aluno vê o próprio histórico; professor e admin veem o de todos
-- ("registro mensal ... tanto para o professor, adm e alunos").
create policy "attendance_monthly_select_own_professor_or_admin"
  on public.attendance_monthly for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_admin()
    or public.is_professor()
  );

grant select on public.attendance_monthly to authenticated;
grant select, insert, update, delete on public.attendance_monthly to service_role;
