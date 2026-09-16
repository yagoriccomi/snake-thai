-- ============================================================================
-- Exclusão de conta (LGPD art. 18, VI) numa única transação — T7
--
-- Até aqui a Edge Function delete-my-account anonimizava o perfil com chamadas
-- separadas e deixava três falhas para trás:
--   1. as IMAGENS dos comprovantes continuavam no provedor (a função nunca
--      chamava eliminar_comprovantes_do_titular, embora a documentação dissesse
--      que chamava);
--   2. as justificativas de falta ficavam — texto livre, que pode trazer dado
--      de saúde (dado sensível, art. 11) — e o anexo junto;
--   3. cada comprovante entrava DUAS vezes na fila de eliminação, a segunda com
--      o motivo errado ("comprovante_recusado").
-- E, por não ser atômica, uma falha no meio deixava a conta meio anonimizada.
--
-- Agora a regra inteira mora em anonimizar_titular(): transacional, idempotente
-- e chamada só pelo servidor. As Edge Functions cuidam só do que é do Auth. [#89]
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fila de eliminação sem duplicata
--
--    eliminar_comprovantes_do_titular() enfileira e depois zera os ponteiros;
--    esse UPDATE disparava o gatilho abaixo, que enfileirava o mesmo arquivo de
--    novo. Arquivo já pendente na fila não entra outra vez.
-- ----------------------------------------------------------------------------
create or replace function public.enfileirar_exclusao_de_comprovante()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_provider  public.media_provider;
  v_asset_ref text;
  v_motivo    public.media_deletion_reason;
begin
  if tg_op = 'DELETE' then
    v_provider  := old.proof_provider;
    v_asset_ref := coalesce(old.proof_public_id, old.proof_storage_path, old.proof_url);
    v_motivo    := 'conta_excluida';
  else
    -- Só interessa a transição "tinha comprovante" -> "não tem mais".
    if old.proof_provider is null then
      return new;
    end if;
    if new.proof_public_id is not null or new.proof_storage_path is not null then
      return new;
    end if;
    v_provider  := old.proof_provider;
    v_asset_ref := coalesce(old.proof_public_id, old.proof_storage_path, old.proof_url);
    v_motivo    := 'comprovante_recusado';
  end if;

  if v_provider is null or v_asset_ref is null or length(trim(v_asset_ref)) = 0 then
    return coalesce(new, old);
  end if;

  if exists (
    select 1
      from public.media_deletion_queue q
     where q.provider = v_provider
       and q.asset_ref = v_asset_ref
       and q.processado_em is null
  ) then
    return coalesce(new, old);
  end if;

  insert into public.media_deletion_queue (provider, asset_ref, payment_id, motivo)
  values (v_provider, v_asset_ref,
          case when tg_op = 'DELETE' then null else old.id end,
          v_motivo);

  return coalesce(new, old);
end;
$funcao$;

revoke execute on function public.enfileirar_exclusao_de_comprovante() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. anonimizar_titular: a exclusão inteira, numa transação
--
--    Destrói o que identifica a pessoa e preserva o que a lei manda guardar:
--      · perfil: nome, CPF, telefone, nascimento, turma e plano apagados;
--      · pagamentos: mantidos (art. 16, I); só a IMAGEM do comprovante sai;
--      · presenças e frequência mensal: mantidas, sem identidade;
--      · justificativas: apagadas (o gatilho manda o anexo para a fila);
--      · consentimentos: apagados;
--      · professor: sai das aulas FUTURAS; as passadas mostram quem deu a aula.
--    Conta de administrador é recusada: precisa ser rebaixada antes, para
--    ninguém perder o controle do sistema por um toque.
--    Chamar de novo é seguro: devolve ja_anonimizado sem refazer nada.
-- ----------------------------------------------------------------------------
create or replace function public.anonimizar_titular(p_user_id uuid, p_solicitante uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_perfil          public.profiles%rowtype;
  v_comprovantes    integer;
  v_justificativas  integer;
  v_aulas_futuras   integer := 0;
begin
  select * into v_perfil
    from public.profiles
   where id = p_user_id
     for update;

  if not found then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;

  if v_perfil.anonymized_at is not null then
    return jsonb_build_object('ja_anonimizado', true);
  end if;

  if v_perfil.role = 'admin' then
    raise exception 'Rebaixe o administrador antes de excluir a conta.' using errcode = '42501';
  end if;

  v_comprovantes := public.eliminar_comprovantes_do_titular(p_user_id);

  delete from public.absence_justifications where user_id = p_user_id;
  get diagnostics v_justificativas = row_count;

  delete from public.consents where user_id = p_user_id;

  if v_perfil.role = 'professor' then
    -- A cor fica: a constraint exige cor em todo professor, e as aulas passadas
    -- continuam pintadas com ela.
    delete from public.class_teachers ct
     using public.classes c
     where ct.class_id = c.id
       and ct.teacher_id = p_user_id
       and c.date_time > now();
    get diagnostics v_aulas_futuras = row_count;
  end if;

  update public.profiles
     set name           = 'Usuário removido',
         cpf            = null,
         phone          = null,
         dob            = null,
         group_id       = null,
         plan_id        = null,
         status         = 'inactive',
         deactivated_at = coalesce(deactivated_at, now()),
         anonymized_at  = now()
   where id = p_user_id;

  -- Quem pediu: pela service_role o actor_id do gatilho de auditoria fica nulo.
  insert into public.audit_log (actor_id, action, entity, entity_id, changes)
  values (
    p_solicitante,
    'UPDATE',
    'profiles',
    p_user_id::text,
    jsonb_build_object(
      'lgpd_exclusao',
      jsonb_build_object('origem', case when p_solicitante = p_user_id then 'titular' else 'administrador' end)
    )
  );

  return jsonb_build_object(
    'ja_anonimizado', false,
    'comprovantes', v_comprovantes,
    'justificativas', v_justificativas,
    'aulas_futuras', v_aulas_futuras
  );
end;
$funcao$;

comment on function public.anonimizar_titular(uuid, uuid) is
  'LGPD art. 18, VI: anonimiza o titular numa transação (perfil, imagens de comprovante, justificativas, consentimentos, aulas futuras do professor), preservando o registro financeiro. Idempotente. Só service_role (Edge Functions delete-my-account e delete-user-account).';

revoke execute on function public.anonimizar_titular(uuid, uuid) from public, anon, authenticated;
grant execute on function public.anonimizar_titular(uuid, uuid) to service_role;

-- A antiga descrição dizia que a Edge Function chamava esta função direto.
comment on function public.eliminar_comprovantes_do_titular(uuid) is
  'LGPD art. 18, VI: elimina as IMAGENS dos comprovantes do titular, preservando os registros financeiros (art. 16, I). Chamada por anonimizar_titular().';

-- ----------------------------------------------------------------------------
-- 3. Portabilidade (art. 18, V): o export passa a trazer tudo do titular
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
      select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())
    ),
    'presencas', (
      select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from public.attendance a where a.user_id = (select auth.uid())
    ),
    'frequencia_mensal', (
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      from public.attendance_monthly m where m.user_id = (select auth.uid())
    ),
    'justificativas', (
      select coalesce(jsonb_agg(to_jsonb(j)), '[]'::jsonb)
      from public.absence_justifications j where j.user_id = (select auth.uid())
    ),
    'pagamentos', (
      select coalesce(jsonb_agg(to_jsonb(pay)), '[]'::jsonb)
      from public.payments pay where pay.user_id = (select auth.uid())
    ),
    'consentimentos', (
      select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      from public.consents c where c.user_id = (select auth.uid())
    ),
    'exportado_em', now()
  );
$function$;

comment on function public.export_my_data() is
  'Exporta os dados do titular autenticado em JSON (LGPD art. 18, V): perfil, presenças, frequência mensal, justificativas, pagamentos e consentimentos.';

-- ----------------------------------------------------------------------------
-- 4. E-mail do aluno para o admin
--
--    O e-mail só existe em auth.users. Sem isto o admin não consegue nem ver o
--    e-mail que digitou errado no cadastro.
-- ----------------------------------------------------------------------------
create or replace function public.email_do_usuario(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $funcao$
begin
  if not public.is_admin() then
    raise exception 'Somente administradores veem o e-mail de outro usuário.' using errcode = '42501';
  end if;
  return (select u.email::text from auth.users u where u.id = p_user_id);
end;
$funcao$;

revoke execute on function public.email_do_usuario(uuid) from public, anon;
grant execute on function public.email_do_usuario(uuid) to authenticated;

-- A troca de e-mail pelo admin (Edge Function admin-update-user-email) confere
-- antes: o Auth responde e-mail duplicado com um 500 genérico, indistinguível
-- de uma falha real. Só o servidor pergunta — não vira enumeração de e-mails.
create or replace function public.email_ja_cadastrado(p_email text, p_exceto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $funcao$
  select exists (
    select 1 from auth.users u
     where lower(u.email) = lower(trim(p_email))
       and u.id <> p_exceto
  );
$funcao$;

revoke execute on function public.email_ja_cadastrado(text, uuid) from public, anon, authenticated;
grant execute on function public.email_ja_cadastrado(text, uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 5. Ninguém apaga perfil pelo app
--
--    O DELETE em profiles cascateia para pagamentos, presenças e justificativas:
--    apagaria o histórico financeiro que a lei manda guardar. Excluir conta é
--    anonimizar (seção 2), e isso só o servidor faz.
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_delete_admin" on public.profiles;
revoke delete on public.profiles from authenticated;
