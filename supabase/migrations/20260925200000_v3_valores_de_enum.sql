-- ============================================================================
-- Contrato v3 — valores novos de enum (bloco 4.1, fatia 1)
--
-- Isolada de propósito (contrato § 0.1, regra 6): um valor criado por
-- `ALTER TYPE ... ADD VALUE` não pode ser usado na mesma transação em que
-- nasce. As migrations seguintes da série usam estes valores em gatilhos,
-- constraints e testes.
--
-- A ordem de publicação (§ 14) põe a Edge Function `send-push` com os tipos
-- novos e um `default` ANTES destas migrations: um tipo desconhecido quebraria
-- o lote inteiro de push.
-- ============================================================================

-- § 10: seis tipos da v2 e os quatro de troca de aula da v3.
alter type public.notification_kind add value if not exists 'aula_cancelada';
alter type public.notification_kind add value if not exists 'aula_reativada';
alter type public.notification_kind add value if not exists 'justificativa_aprovada';
alter type public.notification_kind add value if not exists 'justificativa_negada';
alter type public.notification_kind add value if not exists 'chamada_retificada';
alter type public.notification_kind add value if not exists 'solicitacao_pendente';
alter type public.notification_kind add value if not exists 'troca_pendente';
alter type public.notification_kind add value if not exists 'troca_aprovada';
alter type public.notification_kind add value if not exists 'troca_negada';
alter type public.notification_kind add value if not exists 'troca_aprovada_equipe';

-- § 8: o anexo de motivo apagado (motivo não usado ou removido) e o anexo que
-- venceu o prazo de guarda de 180 dias depois da decisão (D54, T45).
alter type public.media_deletion_reason add value if not exists 'anexo_de_motivo_removido';
alter type public.media_deletion_reason add value if not exists 'anexo_expirado';
