-- ============================================================================
-- Snake Thai — novo papel: professor
-- ----------------------------------------------------------------------------
-- Migration ISOLADA de propósito: o Postgres não permite usar um valor de
-- enum recém-adicionado (`ALTER TYPE ... ADD VALUE`) na MESMA transação em
-- que ele foi criado. Qualquer policy/trigger que referencie 'professor'
-- precisa estar numa migration POSTERIOR — daí este arquivo conter só isto.
-- ============================================================================

alter type public.user_role add value 'professor';
