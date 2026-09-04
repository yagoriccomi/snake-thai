-- ============================================================================
-- Snake Thai — Diretório de perfis (correção de visibilidade)
-- ----------------------------------------------------------------------------
-- BUG que isto corrige: ao criar o papel de professor, as policies de
-- `class_teachers` e `attendance` foram abertas para ele, mas ambas dependem
-- de LER `profiles` — e a policy de leitura continuou sendo "só o próprio
-- perfil ou admin". O resultado, verificado em produção:
--
--   · professor via 0 alunos  → a tela de Frequência ficava VAZIA para ele,
--     deixando inoperante justamente o "professor gerencia os alunos das
--     suas aulas";
--   · professor via só a si mesmo entre os professores → numa aula com dois
--     professores, a bolinha do colega não aparecia;
--   · aluno via só o próprio perfil → nunca via o nome nem a cor do professor
--     da própria aula.
--
-- Por que uma VIEW e não uma policy nova em `profiles`: RLS trabalha por
-- LINHA, não por coluna. Liberar a linha do aluno para o professor entregaria
-- junto CPF, telefone e data de nascimento — dado pessoal que ele não precisa
-- para fazer chamada. A view expõe só o mínimo (id, nome, cor, papel, turma)
-- e carrega a própria regra de visibilidade. [#54]
-- ============================================================================

create view public.diretorio_perfis
with (security_invoker = false)   -- roda como o dono: contorna a RLS da tabela
                                  -- base DE PROPÓSITO, porque a regra de quem
                                  -- vê o quê está no WHERE abaixo, sobre um
                                  -- conjunto de colunas já minimizado.
as
select
  p.id,
  p.name,
  p.color,
  p.role,
  p.group_id,
  p.status
from public.profiles p
where p.anonymized_at is null     -- quem pediu exclusão não volta em lista alguma
  and (
    -- Qualquer autenticado enxerga PROFESSOR: é o que permite desenhar a
    -- bolinha e a borda colorida da aula, inclusive para o aluno.
    p.role = 'professor'
    -- O próprio perfil.
    or p.id = (select auth.uid())
    -- Admin enxerga todo mundo.
    or public.is_admin()
    -- Professor enxerga os ALUNOS — sem isso não há lista de chamada.
    or (public.is_professor() and p.role = 'user')
  );

comment on view public.diretorio_perfis is
  'Projeção mínima de profiles (sem CPF, telefone ou nascimento) com a regra '
  'de visibilidade embutida: professores são públicos para autenticados, o '
  'professor enxerga os alunos, o admin enxerga todos, e cada um enxerga a si.';

revoke all on public.diretorio_perfis from public, anon;
grant select on public.diretorio_perfis to authenticated;
