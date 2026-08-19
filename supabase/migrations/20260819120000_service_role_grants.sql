-- ============================================================================
-- GRANTs para o papel `service_role` (usado pelas Edge Functions)
-- ----------------------------------------------------------------------------
-- O schema original concedeu DML apenas a `authenticated`, seguindo o menor
-- privilégio [#55]. Só que as Edge Functions rodam como `service_role`, que
-- ignora a RLS mas continua sujeito aos GRANTs do Postgres — sem estes,
-- `create-student` e `reset-student-password` falham com 42501
-- ("permission denied for table profiles").
--
-- Continuamos restritivos: nada de DELETE, e nenhuma outra tabela é liberada.
-- O service_role só precisa tocar em `profiles`.
-- ============================================================================

grant select, insert, update on public.profiles to service_role;
