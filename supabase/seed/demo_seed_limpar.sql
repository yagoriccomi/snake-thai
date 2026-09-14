-- ============================================================================
-- Snake Thai — Remoção da semeadura de DEMONSTRAÇÃO
-- ----------------------------------------------------------------------------
-- Desfaz o `demo_seed.sql`: apaga APENAS as contas do domínio
-- `@demo.snakethai.com`. O ON DELETE CASCADE de `profiles`, `payments`,
-- `attendance` e `class_teachers` leva junto tudo que pendia delas.
--
-- O que NÃO é apagado, de propósito:
--   · contas reais (qualquer e-mail fora do domínio de demo);
--   · as contas de teste adm@/aluno@/professor@snake.com;
--   · aulas, turmas e planos — são configuração, não dado semeado.
--
-- Rode antes de colocar a academia em operação de verdade: dado fictício
-- misturado com dado real é pior do que base vazia, porque ninguém sabe qual
-- é qual depois de algumas semanas.
-- ============================================================================

begin;

-- Confere o estrago antes de fazer: quem vai embora.
select count(*) as contas_de_demo_que_serao_removidas
  from auth.users
 where email like '%@demo.snakethai.com';

delete from auth.users where email like '%@demo.snakethai.com';

-- Sobrou alguém do domínio de demo?
select count(*) as restantes from auth.users where email like '%@demo.snakethai.com';

commit;
