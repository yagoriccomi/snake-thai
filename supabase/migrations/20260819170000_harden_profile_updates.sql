-- ============================================================================
-- Correção dos achados críticos 1 e 2 do REVIEW.md
-- ----------------------------------------------------------------------------
-- ACHADO 1 — Broken Access Control (OWASP A01) [#55]
--
-- O trigger que restringe o que o aluno pode alterar no próprio perfil listava
-- os campos PROIBIDOS: id, role, cpf, created_at. As colunas status,
-- deactivated_at e plan_id nasceram depois e, por não estarem na lista,
-- ficaram livres. Explorado com token de aluno comum: ele trancou a própria
-- matrícula e migrou o próprio plano — prejuízo financeiro direto.
--
-- A correção não é acrescentar as três à lista: é INVERTER a lógica. Uma lista
-- de proibidos envelhece mal, porque toda coluna nova nasce desprotegida por
-- padrão e ninguém lembra de atualizar o trigger. Com lista de PERMITIDOS, o
-- padrão passa a ser seguro: coluna nova nasce restrita ao administrador até
-- que alguém decida conscientemente liberá-la.
--
-- ACHADO 2 — PII na trilha de auditoria [#63] (LGPD art. 6º)
--
-- record_audit() gravava o par antes/depois de todo campo alterado, incluindo
-- telefone, CPF e nascimento. Além de multiplicar a exposição, esse dado
-- SOBREVIVIA à exclusão do titular, já que `changes` permanece intacto. Agora o
-- log registra QUE mudou, sem registrar o conteúdo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Perfil: lista de PERMITIDOS em vez de lista de proibidos
-- ----------------------------------------------------------------------------
create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- Únicos campos que o próprio titular pode alterar. Qualquer coluna futura
  -- fica automaticamente fora — o padrão é negar.
  campo_alterado text;
begin
  -- Operação de sistema (service_role, pg_cron): não há usuário para checar.
  if (select auth.uid()) is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Percorre o que de fato mudou e recusa na primeira diferença fora da lista.
  select chave into campo_alterado
  from jsonb_each(to_jsonb(old)) as antigo(chave, valor)
  join jsonb_each(to_jsonb(new)) as novo(chave, valor_novo) using (chave)
  where antigo.valor is distinct from novo.valor_novo
    and chave not in ('name', 'phone', 'dob', 'is_first_login', 'updated_at')
  limit 1;

  if campo_alterado is not null then
    raise exception
      'Operação negada: o campo "%" só pode ser alterado por um administrador.',
      campo_alterado
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.enforce_profile_update_rules() is
  'Restringe o que o titular altera no proprio perfil a uma lista de permitidos '
  '(name, phone, dob, is_first_login). Coluna nova nasce restrita ao admin.';

-- ----------------------------------------------------------------------------
-- 2. Auditoria: registrar a mudança sem registrar o dado pessoal
-- ----------------------------------------------------------------------------
create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  campos_alterados jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(
             chave,
             case
               -- Dado pessoal: a trilha prova QUE mudou, sem copiar o conteúdo.
               -- Guardar CPF e telefone aqui multiplicaria a exposição e
               -- sobreviveria ao pedido de exclusão do titular (LGPD art. 18).
               when chave in ('cpf', 'phone', 'dob', 'name')
                 then jsonb_build_object('alterado', true)
               else jsonb_build_object('de', antigo.valor, 'para', novo.valor)
             end)
      into campos_alterados
    from jsonb_each(to_jsonb(old)) as antigo(chave, valor)
    join jsonb_each(to_jsonb(new)) as novo(chave, valor) using (chave)
    where antigo.valor is distinct from novo.valor
      and chave not in ('updated_at');
  elsif tg_op = 'INSERT' then
    campos_alterados := jsonb_build_object('criado', true);
  else
    campos_alterados := jsonb_build_object('removido', true);
  end if;

  if campos_alterados is null then
    return coalesce(new, old);
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, changes)
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
    campos_alterados
  );

  return coalesce(new, old);
end;
$$;

comment on function public.record_audit() is
  'Registra INSERT/UPDATE/DELETE em audit_log. Campos de PII entram como '
  '{"alterado": true} — a trilha prova a mudanca sem copiar o dado pessoal.';

-- ----------------------------------------------------------------------------
-- 3. Expurgo do que já foi gravado em claro antes desta correção
-- ----------------------------------------------------------------------------
-- Corrigir o gatilho não desfaz o passado: as linhas existentes continuam com
-- telefone e CPF legíveis. Substituímos o conteúdo preservando o registro de
-- que a alteração ocorreu.
update public.audit_log
   set changes = (
     select jsonb_object_agg(
              chave,
              case when chave in ('cpf', 'phone', 'dob', 'name')
                   then jsonb_build_object('alterado', true)
                   else valor end)
     from jsonb_each(changes) as t(chave, valor)
   )
 where changes ?| array['cpf', 'phone', 'dob', 'name'];
