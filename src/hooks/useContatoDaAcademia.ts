import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { fetchContatoDaAcademia } from '@/services/contato.service';
import type { ContatoDaAcademia } from '@/utils/contato';

const log = createLogger('useContatoDaAcademia');

export const ERRO_AO_CARREGAR_CONTATO = 'Não foi possível carregar o contato da academia. Verifique sua conexão.';

interface ContatoState {
  contato: ContatoDaAcademia | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Carrega o contato da academia quando `ativo` (ex.: a folha aberta). A falha
 * vai para o log e para a tela, com "Tentar de novo" [#92][#93].
 */
export function useContatoDaAcademia(ativo = true): ContatoState {
  const [contato, setContato] = useState<ContatoDaAcademia | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    fetchContatoDaAcademia()
      .then(setContato)
      .catch((falha: unknown) => {
        log.warn('Falha ao carregar o contato da academia', falha);
        setErro(ERRO_AO_CARREGAR_CONTATO);
      })
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (ativo) carregar();
  }, [ativo, carregar]);

  return { contato, carregando, erro, recarregar: carregar };
}
