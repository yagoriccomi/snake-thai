-- ============================================================================
-- Snake Thai — payments: concede ao service_role o que faltava
-- ----------------------------------------------------------------------------
-- Toda tabela deste projeto que precisou de acesso via service_role ganhou um
-- grant explícito na sua própria migration (profiles, plans, academy_settings,
-- media_deletion_queue). `payments` foi criada na migration inicial e recebeu
-- apenas `grant ... to authenticated` — sem ninguém precisar do service_role
-- nela até agora.
--
-- `scripts/migrar-comprovantes.ts` é a primeira coisa a precisar: ele lê os
-- pagamentos ainda no Supabase Storage (SELECT) e vira a chave de cada um para
-- a Cloudinary (UPDATE), fora do alcance de qualquer aluno — por isso o script
-- roda com service_role, isolado do servidor web (ver docs/DEPLOY.md).
--
-- Sem este grant o erro é 42501 "permission denied for table payments", não
-- uma negativa de RLS: o service_role já ignora RLS por natureza, mas GRANT de
-- tabela é uma camada separada, e faltava aqui.
-- ============================================================================

grant select, update on public.payments to service_role;
