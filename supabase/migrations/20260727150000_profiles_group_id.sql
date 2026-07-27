-- ============================================================================
-- Snake Thai — Turma do aluno (group_id em profiles)
-- ----------------------------------------------------------------------------
-- O módulo de Aulas segmenta as aulas de rotina por turma. O aluno vê as aulas
-- da sua turma (profiles.group_id) somadas aos eventos globais (classes.group_id
-- nulo). O admin usa o group_id para vincular a rotina e listar a frequência.
-- ============================================================================

alter table public.profiles add column group_id text;

create index idx_profiles_group_id on public.profiles (group_id);

comment on column public.profiles.group_id is
  'Turma do aluno; segmenta as aulas de rotina exibidas a ele.';
