-- ============================================================================
-- D45 e D49 (coordenação, 08/10; contrato v7, § 10) — valor novo de enum
--
-- Isolada de propósito (§ 0.1, regra 6): o valor criado por ALTER TYPE ...
-- ADD VALUE não pode ser usado na transação em que nasce. A migration
-- seguinte (o push semanal da D49) e os testes o usam.
--
-- Ordem de publicação (§ 14): a send-push com o tipo novo vai ao ar antes
-- desta migration. A send-push antiga mostraria só o texto genérico.
-- ============================================================================

alter type public.notification_kind add value if not exists 'versao_nova';
