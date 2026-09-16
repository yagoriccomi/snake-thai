import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthProvider';
import { createLogger } from '@/lib/logger';
import { fetchPendingLegalDocuments } from '@/services/legalDocuments.service';

const log = createLogger('LegalConsent');

/**
 * - `inativo`: sem sessão ou ainda no primeiro acesso (o onboarding cuida do aceite).
 * - `verificando`: consultando o banco; o app segue aberto enquanto isso.
 * - `em_dia`: nenhuma versão vigente sem aceite.
 * - `pendente`: há versão nova a aceitar; a raiz mostra a tela de aceite.
 * - `falhou`: não deu para conferir; o app segue aberto e confere ao voltar.
 */
export type StatusDoAceite = 'inativo' | 'verificando' | 'em_dia' | 'pendente' | 'falhou';

interface LegalConsentContextValue {
  status: StatusDoAceite;
  /** A raiz deve mostrar a tela de aceite em vez das abas. */
  precisaAceitar: boolean;
  /** Confere de novo (depois de aceitar, por exemplo). */
  verificar: () => Promise<void>;
}

const LegalConsentContext = createContext<LegalConsentContextValue | undefined>(undefined);

/**
 * Pede o aceite de cada nova versão da Política de Privacidade e dos Termos de
 * Uso (L4). Enquanto nada estiver publicado, nunca fica `pendente`.
 *
 * A checagem não segura a abertura do app e, se falhar (sem rede), deixa a
 * pessoa entrar: travar um aluno fora do app por oscilação de rede é pior do
 * que pedir o aceite na próxima vez. A falha vai para o log e a checagem
 * repete quando o app volta ao primeiro plano.
 */
export function LegalConsentProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? null;
  const habilitado = userId !== null && profile !== null && !profile.is_first_login;

  const [status, setStatus] = useState<StatusDoAceite>('inativo');
  const statusRef = useRef<StatusDoAceite>('inativo');
  // Descarta resposta atrasada de uma checagem anterior (troca de conta).
  const consultaAtual = useRef(0);

  const mudarStatus = useCallback((novo: StatusDoAceite) => {
    statusRef.current = novo;
    setStatus(novo);
  }, []);

  const verificar = useCallback(async (): Promise<void> => {
    if (!habilitado) return;
    const consulta = consultaAtual.current + 1;
    consultaAtual.current = consulta;
    // Quem já está na tela de aceite continua nela até a resposta chegar.
    if (statusRef.current !== 'pendente') mudarStatus('verificando');
    try {
      const pendentes = await fetchPendingLegalDocuments();
      if (consulta !== consultaAtual.current) return;
      mudarStatus(pendentes.length > 0 ? 'pendente' : 'em_dia');
    } catch (falha) {
      if (consulta !== consultaAtual.current) return;
      log.warn('Não foi possível conferir o aceite dos documentos legais', falha);
      mudarStatus('falhou');
    }
  }, [habilitado, mudarStatus]);

  useEffect(() => {
    if (!habilitado) {
      consultaAtual.current += 1;
      mudarStatus('inativo');
      return;
    }
    void verificar();
  }, [habilitado, userId, verificar, mudarStatus]);

  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && statusRef.current === 'falhou') void verificar();
    });
    return () => assinatura.remove();
  }, [verificar]);

  const valor = useMemo<LegalConsentContextValue>(
    () => ({ status, precisaAceitar: habilitado && status === 'pendente', verificar }),
    [status, habilitado, verificar],
  );

  return <LegalConsentContext.Provider value={valor}>{children}</LegalConsentContext.Provider>;
}

/** Estado do aceite dos documentos legais da sessão. */
export function useLegalConsent(): LegalConsentContextValue {
  const contexto = useContext(LegalConsentContext);
  if (contexto === undefined) {
    throw new Error('useLegalConsent precisa estar dentro de <LegalConsentProvider>.');
  }
  return contexto;
}
