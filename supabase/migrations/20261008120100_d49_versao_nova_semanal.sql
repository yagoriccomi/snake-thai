-- ============================================================================
-- D49 da coordenação (08/10; contrato v7, § 10) — push semanal de versão nova
--
-- Substitui o aviso único da D45 (avisar_versao_nova, nunca publicado): o
-- push vai só para quem tem aparelho DESATUALIZADO, no máximo uma vez por
-- semana, até atualizar.
--
--   1. o app informa a própria versão ao registrar o aparelho
--      (push_devices.app_version); o APK 1.8 não informa, e nulo conta como
--      desatualizado;
--   2. a versão vigente fica em academy_settings.current_app_version, que o
--      admin (ou o dono, no SQL Editor) define ao liberar uma versão;
--   3. o pg_cron roda enfileirar_avisos_de_versao_nova toda segunda às 10h
--      (São Paulo). A chave é a semana ISO: rodar de novo na mesma semana não
--      reenvia.
--
-- Compatibilidade (§ 15): o APK 1.8 chama registrar_dispositivo_push com três
-- argumentos nomeados, e o quarto tem padrão; academy_settings ganha a coluna
-- no fim, para o select('*') antigo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Formato da versão: um lugar só
-- ----------------------------------------------------------------------------
-- "X.Y.Z" sem zero à esquerda, como a tag vX.Y.Z do release (§ 12.3); nulo
-- fora do formato. As duas constraints e as duas RPCs usam esta função.
create function public.normalizar_versao_do_app(p_versao text)
returns text
language sql
immutable
set search_path = ''
as $$
  select m[1]::integer || '.' || m[2]::integer || '.' || m[3]::integer
    from regexp_match(p_versao, '^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$') as m
   where m is not null;
$$;

comment on function public.normalizar_versao_do_app(text) is
  'D49: "X.Y.Z" sem zero à esquerda (até 4 dígitos cada); nulo fora do formato.';

-- Roda dentro das constraints com a permissão de quem grava (o admin salva
-- Configurações): é pura, então o grant não expõe nada. O anon fica de fora.
revoke execute on function public.normalizar_versao_do_app(text) from public, anon;
grant execute on function public.normalizar_versao_do_app(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Colunas
-- ----------------------------------------------------------------------------
alter table public.push_devices
  add column app_version text null;

alter table public.push_devices
  add constraint push_devices_versao_do_app_valida check (
    app_version is null or public.normalizar_versao_do_app(app_version) is not distinct from app_version
  );

comment on column public.push_devices.app_version is
  'D49: versão do app instalado ("X.Y.Z"), informada a cada registro. Nula no APK 1.8, que não informa: conta como desatualizado.';

-- Por último: o APK 1.8 faz select('*') nesta tabela (§ 15).
alter table public.academy_settings
  add column current_app_version text null;

alter table public.academy_settings
  add constraint academy_settings_versao_vigente_valida check (
    current_app_version is null or public.normalizar_versao_do_app(current_app_version) is not distinct from current_app_version
  );

comment on column public.academy_settings.current_app_version is
  'D49: versão vigente do app ("X.Y.Z"), definida por definir_versao_vigente_do_app ao liberar uma versão. Nula: o push semanal de versão nova fica desligado.';

-- ----------------------------------------------------------------------------
-- 3. Registrar o aparelho com a versão
--
-- Troca de assinatura: o drop vem antes porque duas versões da função
-- (3 e 4 argumentos) deixariam a chamada de 3 argumentos ambígua.
-- ----------------------------------------------------------------------------
drop function public.registrar_dispositivo_push(text, public.push_platform, public.app_variant);

create function public.registrar_dispositivo_push(
  p_token text,
  p_plataforma public.push_platform,
  p_variante public.app_variant,
  p_versao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  -- Aparelhos por pessoa: acima disso sai o que não abre o app há mais tempo.
  c_maximo_de_aparelhos constant integer := 5;
  v_uid uuid := (select auth.uid());
  v_versao text := public.normalizar_versao_do_app(p_versao);
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Operação negada: entre na conta para ativar notificações.' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid and p.anonymized_at is not null) then
    raise exception 'Operação negada: conta excluída.' using errcode = '42501';
  end if;

  if p_versao is not null and v_versao is null then
    raise exception 'Versão do aplicativo inválida: envie só o número, no formato 2.0.0.' using errcode = '22023';
  end if;

  insert into public.push_devices (user_id, expo_token, platform, app_variant, app_version, last_seen_at)
  values (v_uid, p_token, p_plataforma, p_variante, v_versao, clock_timestamp())
  on conflict (expo_token) do update
     set user_id      = excluded.user_id,
         platform     = excluded.platform,
         app_variant  = excluded.app_variant,
         -- Sempre a do último registro: o APK 1.8 (sem versão) volta a nulo.
         app_version  = excluded.app_version,
         -- clock_timestamp, não now(): a ordem "mais antigo" precisa valer até dentro da mesma transação.
         last_seen_at = clock_timestamp()
  returning id into v_id;

  delete from public.push_devices d
   where d.user_id = v_uid
     and d.id in (
       select antigos.id from public.push_devices antigos
        where antigos.user_id = v_uid
        order by antigos.last_seen_at desc
        offset c_maximo_de_aparelhos
     );

  return v_id;
end;
$funcao$;

comment on function public.registrar_dispositivo_push(text, public.push_platform, public.app_variant, text) is
  'T9 e D49: grava (ou reatribui a quem está logado) o token Expo e a versão do app do aparelho, e mantém no máximo 5 aparelhos por pessoa.';

revoke execute on function public.registrar_dispositivo_push(text, public.push_platform, public.app_variant, text) from public, anon;
grant execute on function public.registrar_dispositivo_push(text, public.push_platform, public.app_variant, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Versão vigente: o admin define ao liberar uma versão
-- ----------------------------------------------------------------------------
create function public.definir_versao_vigente_do_app(p_versao text)
returns text
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  -- SQL Editor e service_role: sem usuário, mas não anônimo (§ 0.1).
  v_sistema boolean := (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon';
  v_versao text := public.normalizar_versao_do_app(p_versao);
begin
  if not v_sistema and not public.is_admin() then
    raise exception 'Operação negada: só o admin define a versão vigente do aplicativo.' using errcode = '42501';
  end if;

  -- Nulo desliga o push semanal; texto fora de X.Y.Z é erro, não desliga.
  if p_versao is not null and v_versao is null then
    raise exception 'Versão inválida: use o formato 2.0.0, sem "v" e sem sufixo.' using errcode = '22023';
  end if;

  update public.academy_settings set current_app_version = v_versao where id;
  return v_versao;
end;
$funcao$;

comment on function public.definir_versao_vigente_do_app(text) is
  'D49 (contrato v7, § 10): grava a versão vigente do app ("X.Y.Z", normalizada) ou nulo para desligar o push semanal. Só admin ou sistema. Devolve o valor gravado.';

revoke execute on function public.definir_versao_vigente_do_app(text) from public, anon;
grant execute on function public.definir_versao_vigente_do_app(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. O push semanal
-- ----------------------------------------------------------------------------
create function public.enfileirar_avisos_de_versao_nova(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_vigente integer[];
  -- Semana ISO em São Paulo: a mesma chave na semana inteira, então a segunda
  -- chamada (o cron de novo ou o dono à mão) não reenvia.
  v_chave text := 'versao_nova:' || to_char(p_agora at time zone 'America/Sao_Paulo', 'IYYY-"W"IW');
  v_destinatario uuid;
  v_avisados integer := 0;
begin
  select string_to_array(s.current_app_version, '.')::integer[]
    into v_vigente
    from public.academy_settings s;

  if v_vigente is null then
    return 0;
  end if;

  -- Um aviso por perfil com ALGUM aparelho desatualizado: a fila é por
  -- pessoa, e o despacho manda para todos os aparelhos dela.
  for v_destinatario in
    select distinct d.user_id
      from public.push_devices d
      join public.profiles p on p.id = d.user_id
     where p.status = 'active' and p.anonymized_at is null
       and (d.app_version is null or string_to_array(d.app_version, '.')::integer[] < v_vigente)
  loop
    if public.enfileirar_notificacao(v_destinatario, 'versao_nova', v_chave, p_agora => p_agora) then
      v_avisados := v_avisados + 1;
    end if;
  end loop;

  return v_avisados;
end;
$funcao$;

comment on function public.enfileirar_avisos_de_versao_nova(timestamptz) is
  'D49 (contrato v7, § 10): enfileira versao_nova para os perfis ativos com aparelho sem versão ou abaixo da vigente, com a chave da semana ISO (São Paulo). Sem versão vigente, não faz nada. Devolve quantos entraram na fila agora.';

-- Como as outras rotinas do pg_cron: só o sistema (o cron e o SQL Editor).
revoke execute on function public.enfileirar_avisos_de_versao_nova(timestamptz) from public, anon, authenticated;

-- Segunda-feira, 13:00 UTC = 10:00 em São Paulo (sem horário de verão desde 2019).
select cron.schedule('push-versao-nova-semanal', '0 13 * * 1', $$select public.enfileirar_avisos_de_versao_nova()$$);

-- ----------------------------------------------------------------------------
-- 6. Portabilidade (§ 12.1): a versão do app entra nos aparelhos exportados
-- ----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  -- SECURITY INVOKER de propósito: a RLS continua valendo, então cada titular
  -- só exporta os próprios dados — nem com a função na mão alguém lê a de outro.
  select jsonb_build_object(
    'perfil', (
      select jsonb_build_object(
               'nome', p.name, 'cpf', p.cpf, 'celular', p.phone, 'nascimento', p.dob,
               'papel', p.role, 'situacao', p.status, 'turma', p.group_id, 'plano', p.plan_id,
               'cor', p.color, 'canal_de_acesso', p.access_channel,
               'criado_em', p.created_at, 'trancado_em', p.deactivated_at)
        from public.profiles p where p.id = (select auth.uid())
    ),
    'presencas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'class_id', a.class_id, 'declared_status', a.declared_status,
               'status', a.status, 'edited', a.edited)), '[]'::jsonb)
        from public.attendance a where a.user_id = (select auth.uid())
    ),
    'frequencia_mensal', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'mes', m.reference_month, 'modalidade', m.schedule_mode, 'esperadas', m.expected,
               'feitas', m.attended, 'abonadas', m.excused, 'canceladas', m.cancelled,
               'percentual', m.frequency_percent, 'fechado_em', m.closed_at)
             order by m.reference_month), '[]'::jsonb)
        from public.attendance_monthly m where m.user_id = (select auth.uid())
    ),
    -- D16: quem negou e a nota nunca saem; o aprovador, só na aprovada.
    'justificativas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', j.id, 'scope', j.scope, 'class_id', j.class_id, 'week_start', j.week_start,
               'message', j.message, 'status', j.status, 'attempt', j.attempt,
               'reviewed_at', j.reviewed_at, 'approved_by_name', j.approved_by_name)
             order by j.created_at), '[]'::jsonb)
        from public.minhas_justificativas() j
    ),
    'solicitacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'kind', s.kind, 'class_id', s.class_id, 'class_title', s.class_title,
               'class_date_time', s.class_date_time, 'status', s.status,
               'approved_by_name', s.approved_by_name, 'created_at', s.created_at)
             order by s.created_at), '[]'::jsonb)
        from public.minhas_solicitacoes() s
    ),
    'metas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'semana', g.effective_week_start, 'meta', g.goal, 'definida_em', g.set_at)
             order by g.effective_week_start), '[]'::jsonb)
        from public.weekly_goals g where g.user_id = (select auth.uid())
    ),
    'periodos_de_plano', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'plano', pl.name, 'inicio', pp.started_at, 'fim', pp.ended_at)
             order by pp.started_at), '[]'::jsonb)
        from public.plan_periods pp
        left join public.plans pl on pl.id = pp.plan_id
       where pp.user_id = (select auth.uid())
    ),
    'periodos_inativos', (
      select coalesce(jsonb_agg(jsonb_build_object('inicio', ip.started_at, 'fim', ip.ended_at)
             order by ip.started_at), '[]'::jsonb)
        from public.inactive_periods ip where ip.user_id = (select auth.uid())
    ),
    -- Todas, sem filtro de data: nunca com os padrões, que trazem só 60 dias.
    'trocas', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb)
        from public.minhas_trocas('-infinity'::date, 'infinity'::date) t
    ),
    'trocas_permanentes', (
      select coalesce(jsonb_agg(to_jsonb(tp) order by tp.started_at), '[]'::jsonb)
        from public.minhas_trocas_permanentes() tp
    ),
    'periodos_de_turma', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'turma', g.name, 'inicio', sgp.started_at, 'fim', sgp.ended_at)
             order by sgp.started_at), '[]'::jsonb)
        from public.student_group_periods sgp
        left join public.groups g on g.id = sgp.group_id
       where sgp.user_id = (select auth.uid())
    ),
    'pagamentos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pay.id, 'mes', pay.reference_month, 'vencimento', pay.due_date,
               'valor_centavos', pay.amount_cents, 'situacao', pay.status, 'pago_em', pay.paid_at,
               'tem_comprovante', pay.proof_url is not null or pay.proof_public_id is not null
                                  or pay.proof_storage_path is not null)
             order by pay.due_date), '[]'::jsonb)
        from public.payments pay where pay.user_id = (select auth.uid())
    ),
    'consentimentos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'documento', d.kind, 'versao', d.version, 'aceito_em', c.accepted_at)
             order by c.accepted_at), '[]'::jsonb)
        from public.consents c
        left join public.legal_documents d on d.id = c.document_id
       where c.user_id = (select auth.uid())
    ),
    'aparelhos_com_notificacao', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'plataforma', d.platform, 'variante', d.app_variant,
               'token', d.expo_token, 'criado_em', d.created_at, 'visto_em', d.last_seen_at,
               'versao_do_app', d.app_version)), '[]'::jsonb)
        from public.push_devices d where d.user_id = (select auth.uid())
    ),
    'notificacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'tipo', o.kind, 'situacao', o.status, 'criada_em', o.created_at, 'enviada_em', o.sent_at)), '[]'::jsonb)
        from public.notification_outbox o where o.recipient_id = (select auth.uid())
    ),
    'exportado_em', now()
  );
$function$;

comment on function public.export_my_data() is
  'LGPD art. 18, V (§ 12.1): os dados do titular com lista explícita de colunas. Nunca a nota da decisão, quem negou, edited_by, previous_status nem auditoria.';

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
