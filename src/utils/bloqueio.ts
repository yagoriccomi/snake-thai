/**
 * Quanto tempo o app pode ficar em segundo plano sem pedir a digital na volta.
 *
 * Decisão do usuário (2026-09-14): o bloqueio acontece só ao reabrir o app ou
 * depois de 10 minutos fora. Antes, qualquer ida ao segundo plano bloqueava —
 * inclusive abrir a galeria para anexar o comprovante, o que desmontava a tela
 * de pagamento no meio do envio.
 */
export const TEMPO_MAXIMO_EM_SEGUNDO_PLANO_MS = 10 * 60 * 1000;

/**
 * A volta ao app deve pedir a digital?
 *
 * @param saiuEm   Instante (ms) em que o app foi para o segundo plano; `null`
 *                 se não saiu.
 * @param voltouEm Instante (ms) em que voltou.
 */
export function deveBloquearAoVoltar(saiuEm: number | null, voltouEm: number): boolean {
  return saiuEm !== null && voltouEm - saiuEm > TEMPO_MAXIMO_EM_SEGUNDO_PLANO_MS;
}
