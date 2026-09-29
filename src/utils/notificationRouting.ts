/**
 * Para onde ir ao tocar numa notificação. Puro e conservador: payload
 * desconhecido ou malformado não navega (a notificação veio de fora do app e
 * não é confiável como entrada).
 */

export type DestinoDaNotificacao =
  | { aba: 'Financeiro'; tela: 'FinanceiroHome' }
  | { aba: 'Aulas'; tela: 'AulasHome' | 'MinhasJustificativas' | 'JustificativasParaRevisar' | 'Solicitacoes' }
  | { aba: 'Aulas'; tela: 'ItensDaSolicitacao'; params: { categoria: 'trocas_de_aula' } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIPOS_FINANCEIROS = new Set([
  'mensalidade_vence_em_breve',
  'mensalidade_vence_hoje',
  'mensalidade_atrasada',
  'comprovante_enviado',
  'comprovante_aprovado',
  'comprovante_recusado',
]);

// Contrato v4 (§ 10): os avisos de aula, chamada e troca abrem Aulas; os de
// justificativa e de solicitação, a lista de quem os recebe.
const PARA_REVISAR = new Set(['justificativa_pendente']);
const SOLICITACOES = new Set(['solicitacao_pendente']);
// § 9.4: o pedido de troca abre Solicitações › Trocas de aula.
const TROCA_PENDENTE = 'troca_pendente';
const MINHAS_JUSTIFICATIVAS = new Set(['justificativa_aprovada', 'justificativa_negada']);
const TIPOS_DE_AULA = new Set([
  'aula_sem_chamada',
  'aulas_sem_chamada_resumo',
  'aula_cancelada',
  'aula_reativada',
  'chamada_retificada',
  'troca_aprovada',
  'troca_negada',
  'troca_aprovada_equipe',
]);

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
  if (PARA_REVISAR.has(tipo)) return { aba: 'Aulas', tela: 'JustificativasParaRevisar' };
  if (MINHAS_JUSTIFICATIVAS.has(tipo)) return { aba: 'Aulas', tela: 'MinhasJustificativas' };
  if (SOLICITACOES.has(tipo)) return { aba: 'Aulas', tela: 'Solicitacoes' };
  if (tipo === TROCA_PENDENTE) {
    return { aba: 'Aulas', tela: 'ItensDaSolicitacao', params: { categoria: 'trocas_de_aula' } };
  }
  if (TIPOS_DE_AULA.has(tipo)) return { aba: 'Aulas', tela: 'AulasHome' };
  return null;
}
