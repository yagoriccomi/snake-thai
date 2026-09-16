/**
 * Para onde ir ao tocar numa notificação. Puro e conservador: payload
 * desconhecido ou malformado não navega (a notificação veio de fora do app e
 * não é confiável como entrada).
 */

export type DestinoDaNotificacao =
  | { aba: 'Financeiro'; tela: 'FinanceiroHome' }
  | { aba: 'Aulas'; tela: 'AulasHome' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIPOS_FINANCEIROS = new Set([
  'mensalidade_vence_em_breve',
  'mensalidade_vence_hoje',
  'mensalidade_atrasada',
  'comprovante_enviado',
  'comprovante_aprovado',
  'comprovante_recusado',
]);

const TIPOS_DE_AULA = new Set(['justificativa_pendente', 'aula_sem_chamada', 'aulas_sem_chamada_resumo']);

const CAMPOS_DE_ID = ['paymentId', 'classId', 'justificationId'] as const;

export function destinoDaNotificacao(data: unknown): DestinoDaNotificacao | null {
  if (typeof data !== 'object' || data === null) return null;
  const payload = data as Record<string, unknown>;

  // Id presente precisa ser UUID: nada de texto arbitrário vindo de fora.
  for (const campo of CAMPOS_DE_ID) {
    const valor = payload[campo];
    if (valor !== undefined && (typeof valor !== 'string' || !UUID.test(valor))) return null;
  }

  const tipo = payload.tipo;
  if (typeof tipo !== 'string') return null;
  if (TIPOS_FINANCEIROS.has(tipo)) return { aba: 'Financeiro', tela: 'FinanceiroHome' };
  if (TIPOS_DE_AULA.has(tipo)) return { aba: 'Aulas', tela: 'AulasHome' };
  return null;
}
