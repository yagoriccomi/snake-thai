import { useCallback } from 'react';

import { useListaRemota, type ListaRemota } from '@/hooks/useListaRemota';
import { type Categoria } from '@/constants/solicitacoes';
import { fetchCaixaDeSolicitacoes, fetchItensDaSolicitacao, fetchMinhasSolicitacoes, type CategoriaDaCaixa, type ItemDaSolicitacao, type MinhaSolicitacao } from '@/services/solicitacoes.service';

/**
 * A caixa da equipe (§ 9.3): as categorias que quem abre vê, com a quantidade.
 *
 * @param enabled `false` para aluno: nem a requisição acontece.
 */
export function useCaixaDeSolicitacoes(enabled = true): ListaRemota<CategoriaDaCaixa> {
  return useListaRemota(fetchCaixaDeSolicitacoes, 'Não foi possível carregar as solicitações.', enabled);
}

export function useItensDaSolicitacao(categoria: Categoria): ListaRemota<ItemDaSolicitacao> {
  const buscar = useCallback(() => fetchItensDaSolicitacao(categoria), [categoria]);
  return useListaRemota(buscar, 'Não foi possível carregar os itens desta categoria.');
}

/** Os pedidos de quem abre: aluno ou professor. */
export function useMinhasSolicitacoes(): ListaRemota<MinhaSolicitacao> {
  return useListaRemota(fetchMinhasSolicitacoes, 'Não foi possível carregar os seus pedidos.');
}
