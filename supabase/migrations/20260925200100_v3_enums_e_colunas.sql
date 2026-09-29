-- ============================================================================
-- Contrato v3 — enums novos, colunas novas e constraints (bloco 4.1, fatia 2)
--
-- Só estrutura: nenhuma regra de comportamento nasce aqui. As travas que
-- usam estas colunas (cancelamento, chamada, justificativa) vêm na fatia 6,
-- e as RPCs, nos blocos seguintes do ROADMAP-thai.
--
-- Compatibilidade com o APK 1.8 e a web atual (§ 15): toda coluna nova tem
-- padrão ou aceita nulo, e `academy_settings.contact_whatsapp` entra por
-- último, para o `select('*')` antigo continuar lendo as mesmas posições.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums da § 5.1
-- ----------------------------------------------------------------------------
create type public.plan_schedule_mode as enum ('fixed', 'free', 'unlimited');
create type public.class_audience as enum ('fixed', 'free', 'both');
create type public.justification_scope as enum ('class', 'week');
-- 'class_swap_evidence' nasce aqui, no create type (§ 5.1): o enum não existia.
create type public.action_reason_kind as enum
  ('roll_call_edit', 'class_cancel', 'class_reactivate', 'request_evidence', 'class_swap_evidence');
create type public.roll_call_request_kind as enum
  ('student_was_present', 'teacher_was_present', 'teacher_absence',
   'teacher_asks_edit', 'teacher_asks_inclusion');
create type public.class_swap_kind as enum ('once', 'permanent');
create type public.class_swap_status as enum ('pending', 'approved', 'rejected', 'expired', 'cancelled');

-- ----------------------------------------------------------------------------
-- 2. Planos: modalidade e cota (D1, D2)
-- ----------------------------------------------------------------------------
-- Todo plano existente é o "horário fixo" de hoje: o padrão preserva a conta.
alter table public.plans
  add column schedule_mode public.plan_schedule_mode not null default 'fixed',
  add column weekly_quota smallint null;

-- `weekly_quota is not null` explícito: com a cota nula, `between` dá nulo, e
-- um CHECK nulo PASSA — o plano livre sem cota entraria (contra a D2).
alter table public.plans
  add constraint plans_cota_coerente check (
    (schedule_mode in ('fixed', 'unlimited') and weekly_quota is null)
    or (schedule_mode = 'free' and weekly_quota is not null and weekly_quota between 1 and 6)
  );

comment on column public.plans.schedule_mode is
  'Modalidade (D1): fixed = turma (o sistema de antes); free = cota semanal; unlimited = à vontade.';
comment on column public.plans.weekly_quota is
  'Aulas por semana do plano livre (1..6). Nula no fixo e no à vontade.';

-- ----------------------------------------------------------------------------
-- 3. Grade e aulas: público, cancelamento e marca de retificação (§ 6)
-- ----------------------------------------------------------------------------
alter table public.class_schedules
  add column audience public.class_audience not null default 'both';

-- O horário "só livres" pode não ter turma (T7).
alter table public.class_schedules
  alter column group_id drop not null;

alter table public.class_schedules
  add constraint class_schedules_turma_coerente check (audience = 'free' or group_id is not null);

-- Aulas existentes: toda grade existente é 'both', e o padrão já copia isso.
alter table public.classes
  add column audience public.class_audience not null default 'both',
  add column cancelled_at timestamptz null,
  add column attendance_edited boolean not null default false;

alter table public.classes
  drop constraint classes_rotina_exige_turma;

alter table public.classes
  add constraint classes_rotina_turma_coerente
  check (type <> 'routine' or audience = 'free' or group_id is not null);

comment on column public.classes.cancelled_at is
  'Quando a aula foi cancelada. Único dado de cancelamento legível por todos (a aula aparece riscada); quem cancelou e por quê ficam em class_audit.';
comment on column public.classes.attendance_edited is
  'Marca "Editada": a chamada foi retificada depois de concluída (D17). Detalhes só para o admin, em class_audit.';

-- ----------------------------------------------------------------------------
-- 4. Chamada: marcas visíveis (§ 7.1)
-- ----------------------------------------------------------------------------
alter table public.attendance
  add column edited boolean not null default false,
  add column included boolean not null default false,
  add column declared_at timestamptz null;

comment on column public.attendance.included is
  'Selo "Incluído": o aluno entrou na chamada sem estar na lista esperada (D5).';
comment on column public.attendance.declared_at is
  'Quando o aluno marcou "Vou". Ordena as declarações da semana para o abono do cancelamento (T29).';

-- ----------------------------------------------------------------------------
-- 5. Justificativas: por aula ou por semana, e duas tentativas (§ 9.1)
-- ----------------------------------------------------------------------------
alter table public.absence_justifications
  add column scope public.justification_scope not null default 'class',
  add column week_start date null,
  add column attempt smallint not null default 1;

-- A semanal (livre) não tem aula.
alter table public.absence_justifications
  alter column class_id drop not null;

-- Backfill: a segunda-feira (São Paulo) da semana da aula. A coluna vira
-- `not null` na fatia 6, junto do gatilho que a preenche: até lá, o upsert do
-- APK 1.8 no banco local continua funcionando.
update public.absence_justifications j
   set week_start = date_trunc('week', c.date_time at time zone 'America/Sao_Paulo')::date
  from public.classes c
 where c.id = j.class_id
   and j.week_start is null;

alter table public.absence_justifications
  add constraint absence_justifications_escopo_coerente check (
    (scope = 'class' and class_id is not null) or (scope = 'week' and class_id is null)
  ),
  add constraint absence_justifications_tentativa_valida check (attempt in (1, 2));

-- Caminho do anexo travado no banco (§ 9.1): o servidor assina só este
-- caminho, e a fila de exclusão copia o valor gravado. `-2` é a 2ª tentativa;
-- o `class_id` é o formato antigo, ainda aceito.
alter table public.absence_justifications
  add constraint absence_justifications_caminho_do_anexo check (
    proof_public_id is null
    or proof_public_id = 'justificativas/' || user_id::text || '/' || id::text
    or proof_public_id = 'justificativas/' || user_id::text || '/' || id::text || '-2'
    or (class_id is not null and proof_public_id = 'justificativas/' || user_id::text || '/' || class_id::text)
  ) not valid;

-- ----------------------------------------------------------------------------
-- 6. Comprovante: a mesma trava de caminho (§ 8)
-- ----------------------------------------------------------------------------
alter table public.payments
  add constraint payments_caminho_do_comprovante check (
    (proof_public_id is null or proof_public_id = 'comprovantes/' || user_id::text || '/' || id::text)
    and (proof_storage_path is null
         or (proof_storage_path like user_id::text || '/%' and position('..' in proof_storage_path) = 0))
  ) not valid;

-- ----------------------------------------------------------------------------
-- 7. Configuração da academia (§ 5.2, § 5.4)
-- ----------------------------------------------------------------------------
create function public.sem_repeticao(p_valores smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select count(distinct d) = cardinality(p_valores) from unnest(p_valores) as d;
$$;

comment on function public.sem_repeticao(smallint[]) is
  'Verdadeiro se o vetor não tem valor repetido. Usada pela constraint dos dias de aula.';

-- Roda dentro da constraint com a permissão de QUEM GRAVA: sem o grant, o
-- admin levaria "permission denied" ao salvar Configurações. É pura (não lê
-- tabela nenhuma), então o grant não expõe nada. O anon continua de fora.
revoke execute on function public.sem_repeticao(smallint[]) from public, anon;
grant execute on function public.sem_repeticao(smallint[]) to authenticated, service_role;

alter table public.academy_settings
  add column class_weekdays smallint[] not null default '{1,2,3,4,5,6}',
  add column default_weekly_goal smallint not null default 4,
  add column attachment_retention_days smallint not null default 180;

-- Por último: o APK 1.8 faz select('*') nesta tabela (§ 15).
alter table public.academy_settings
  add column contact_whatsapp text null;

alter table public.academy_settings
  add constraint academy_settings_dias_de_aula_validos check (
    cardinality(class_weekdays) between 1 and 7
    and class_weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]
    and public.sem_repeticao(class_weekdays)
  ),
  add constraint academy_settings_meta_padrao_valida check (default_weekly_goal between 1 and 6),
  add constraint academy_settings_guarda_de_anexos_valida check (attachment_retention_days between 30 and 3650),
  add constraint academy_settings_whatsapp_valido check (
    contact_whatsapp is null or contact_whatsapp ~ '^55[1-9][1-9][0-9]{8,9}$'
  );

-- O cliente passa a gravar null no lugar de texto vazio (§ 5.4). "Vazio" e
-- "nulo" dizem o mesmo (sem e-mail); a normalização deixa a validação passar.
update public.academy_settings
   set contact_email = null
 where contact_email is not null and btrim(contact_email) = '';

alter table public.academy_settings
  add constraint academy_settings_email_valido check (
    contact_email is null
    or (char_length(contact_email) <= 254 and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  ) not valid;

comment on column public.academy_settings.class_weekdays is
  'Dias de aula da semana (0 = domingo). Padrão seg–sáb (D9). Definem o mês de cada semana (T2).';
comment on column public.academy_settings.default_weekly_goal is
  'Meta semanal padrão do à vontade (D36, T28).';
comment on column public.academy_settings.attachment_retention_days is
  'Dias de guarda dos atestados e anexos de motivo depois da decisão (D22, D54). Só muda com migration e nova Política de Privacidade.';
comment on column public.academy_settings.contact_whatsapp is
  'WhatsApp da academia, E.164 sem o + (55 + DDD + número). Lido só pela RPC contato_da_academia (§ 5.4).';

-- ----------------------------------------------------------------------------
-- 8. Conferência dos dados antigos antes de validar (§ 0.1, regra 7)
--
-- Se algum dado de produção não passar, a migration para aqui com a
-- contagem, antes de qualquer VALIDATE: é preciso corrigir o dado (não a
-- regra) e publicar de novo.
-- ----------------------------------------------------------------------------
do $$
declare
  v_justificativas int;
  v_comprovantes int;
  v_emails int;
begin
  select count(*) into v_justificativas
    from public.absence_justifications
   where not (
     proof_public_id is null
     or proof_public_id = 'justificativas/' || user_id::text || '/' || id::text
     or proof_public_id = 'justificativas/' || user_id::text || '/' || id::text || '-2'
     or (class_id is not null and proof_public_id = 'justificativas/' || user_id::text || '/' || class_id::text)
   );

  select count(*) into v_comprovantes
    from public.payments
   where not (
     (proof_public_id is null or proof_public_id = 'comprovantes/' || user_id::text || '/' || id::text)
     and (proof_storage_path is null
          or (proof_storage_path like user_id::text || '/%' and position('..' in proof_storage_path) = 0))
   );

  select count(*) into v_emails
    from public.academy_settings
   where not (
     contact_email is null
     or (char_length(contact_email) <= 254 and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
   );

  if v_justificativas + v_comprovantes + v_emails > 0 then
    raise exception
      'Dados fora das regras novas: % justificativa(s) com caminho de anexo inválido, % comprovante(s) com caminho inválido, % e-mail(s) da academia inválido(s). Corrija os dados antes de publicar.',
      v_justificativas, v_comprovantes, v_emails;
  end if;
end $$;

alter table public.absence_justifications validate constraint absence_justifications_caminho_do_anexo;
alter table public.payments validate constraint payments_caminho_do_comprovante;
alter table public.academy_settings validate constraint academy_settings_email_valido;
