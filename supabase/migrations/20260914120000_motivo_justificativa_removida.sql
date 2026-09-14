-- ============================================================================
-- Snake Thai — novo motivo na fila de eliminação de mídia (LGPD)
-- ----------------------------------------------------------------------------
-- Migration ISOLADA de propósito: o Postgres não permite usar um valor de enum
-- recém-adicionado na mesma transação em que ele nasce. O gatilho que enfileira
-- o anexo de justificativa (migration seguinte) usa este valor.
-- ============================================================================

alter type public.media_deletion_reason add value 'justificativa_removida';
