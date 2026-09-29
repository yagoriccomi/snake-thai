import { useListaRemota, type ListaRemota } from '@/hooks/useListaRemota';
import {
  fetchJustificativasParaRevisar,
  fetchMinhasJustificativas,
  type JustificativaParaRevisar,
  type MinhaJustificativa,
} from '@/services/justifications.service';

/** As justificativas do aluno, da mais nova à mais antiga. */
export function useMinhasJustificativas(): ListaRemota<MinhaJustificativa> {
  return useListaRemota(fetchMinhasJustificativas, 'Não foi possível carregar as suas justificativas.');
}

/**
 * As pendentes que quem chama pode decidir (T18, D14).
 *
 * @param enabled `false` para aluno: nem a requisição acontece.
 */
export function useJustificativasParaRevisar(enabled = true): ListaRemota<JustificativaParaRevisar> {
  return useListaRemota(fetchJustificativasParaRevisar, 'Não foi possível carregar as justificativas para revisar.', enabled);
}
