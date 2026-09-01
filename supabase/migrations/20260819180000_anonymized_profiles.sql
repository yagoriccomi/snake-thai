-- ============================================================================
-- Estado "conta excluída, dados anonimizados"
-- ----------------------------------------------------------------------------
-- A exclusão do titular (LGPD art. 18, VI) anonimiza o perfil em vez de apagá-lo,
-- porque os lançamentos financeiros precisam sobreviver por obrigação fiscal.
-- Só que a constraint `profiles_complete_when_onboarded` exige nome e CPF em
-- todo perfil já integrado — e um perfil anonimizado não tem nenhum dos dois.
--
-- Havia a saída preguiçosa de marcar `is_first_login = true` para satisfazer a
-- checagem, mas isso seria mentir no modelo: essa flag significa "aguardando
-- onboarding", e a pessoa não está aguardando nada — ela saiu. Estado que não
-- se representa direito vira relatório errado depois.
--
-- Em vez disso, o estado ganha nome próprio.
-- ============================================================================

alter table public.profiles
  add column anonymized_at timestamptz;

comment on column public.profiles.anonymized_at is
  'Quando os dados pessoais foram apagados a pedido do titular (LGPD art. 18, VI). '
  'A linha permanece para manter integros os lancamentos financeiros ja emitidos.';

-- Perfil anonimizado é a terceira forma válida de existir: nem aguardando
-- onboarding, nem completo — encerrado.
alter table public.profiles
  drop constraint profiles_complete_when_onboarded;

alter table public.profiles
  add constraint profiles_complete_when_onboarded
  check (
    is_first_login
    or anonymized_at is not null
    or (name is not null and cpf is not null)
  );

-- Relatórios de alunos precisam excluir contas encerradas sem varrer a tabela.
create index idx_profiles_anonymized on public.profiles (anonymized_at)
  where anonymized_at is not null;
