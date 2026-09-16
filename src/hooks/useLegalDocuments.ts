import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { fetchCurrentLegalDocuments, type DocumentoLegalVigente } from '@/services/legalDocuments.service';

const log = createLogger('useLegalDocuments');

const MENSAGEM_DE_FALHA = 'Não foi possível carregar os documentos. Verifique a conexão e tente de novo.';

interface UseLegalDocumentsResult {
  /** Documentos vigentes (política antes dos termos); vazio se nada foi publicado. */
  documentos: DocumentoLegalVigente[];
  carregando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
}

/**
 * Política de Privacidade e Termos de Uso vigentes, com o texto e a data do
 * aceite do usuário logado. Usado no primeiro acesso, na tela de novo aceite e
 * em Perfil → Termos e privacidade.
 */
export function useLegalDocuments(): UseLegalDocumentsResult {
  const [documentos, setDocumentos] = useState<DocumentoLegalVigente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDocumentos(await fetchCurrentLegalDocuments());
    } catch (falha) {
      // Contornável: a tela oferece "Tentar de novo" e o aceite é pedido depois.
      log.warn('Falha ao carregar os documentos legais', falha);
      setErro(MENSAGEM_DE_FALHA);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { documentos, carregando, erro, recarregar };
}
