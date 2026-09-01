-- ============================================================================
-- Correção de regressão: onboarding do aluno travado pelo allowlist de perfil
-- ----------------------------------------------------------------------------
-- O endurecimento em 20260819170000 trocou a lista de PROIBIDOS por uma de
-- PERMITIDOS no `enforce_profile_update_rules()`. Correto para o dia a dia —
-- mas deixou o `cpf` de fora, e o CPF nasce NULO e é definido pelo próprio
-- aluno no onboarding (`completeProfileOnboarding` grava name, cpf, phone, dob,
-- is_first_login numa tacada só).
--
-- Consequência: a conclusão do cadastro passou a ser recusada com 42501, o
-- `is_first_login` nunca virava false e o app remontava o Onboarding no passo 1
-- — um loop. O onboarding (julho) funcionava; a rodada de segurança (agosto)
-- quebrou-o e o primeiro acesso não foi re-testado.
--
-- A correção NÃO é liberar o CPF: é permitir a sua DEFINIÇÃO INICIAL (null →
-- valor) pelo titular, uma única vez. Depois de definido, o CPF continua
-- imutável para o aluno (só admin altera) — a propriedade de segurança que
-- impede troca de identidade permanece intacta.
-- ============================================================================

create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
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
    -- Exceção do onboarding: o CPF nasce nulo e é definido UMA vez pelo próprio
    -- titular. Só a transição null → valor é permitida; alterar um CPF já
    -- existente (ou apagá-lo) continua restrito ao administrador.
    and not (chave = 'cpf' and old.cpf is null and new.cpf is not null)
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
  '(name, phone, dob, is_first_login). O CPF pode ser definido uma unica vez no '
  'onboarding (null -> valor); depois disso, so o admin altera. Coluna nova '
  'nasce restrita ao admin.';
