import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { createLogger } from '@/lib/logger';
import { forceNativeCrash, monitoringEnvironment, type AmbienteDeMonitoramento } from '@/lib/monitoring';

const log = createLogger('DiagnosticoDeErros');

/** Texto fixo do erro de teste: fácil de achar (e de ignorar) no painel. */
export const MARCA_DO_TESTE = 'SNAKE_TESTE_MONITORAMENTO';

interface UseDiagnosticoDeErrosResult {
  /** Só fora de produção (app DEV). */
  visivel: boolean;
  /** Abre as opções de teste. */
  abrir: () => void;
  /** A tela deve lançar um erro de renderização agora. */
  erroDeTela: boolean;
}

/**
 * Gatilhos para conferir o monitoramento de ponta a ponta num APK de teste:
 * erro enviado pelo logger, erro de renderização (ErrorBoundary) e travamento
 * nativo. Nunca aparece no app de produção.
 */
export function useDiagnosticoDeErros(
  ambiente: AmbienteDeMonitoramento = monitoringEnvironment,
): UseDiagnosticoDeErrosResult {
  const [erroDeTela, setErroDeTela] = useState(false);
  const visivel = ambiente !== 'production';

  const abrir = useCallback(() => {
    if (!visivel) return;
    Alert.alert(
      'Diagnóstico de erros',
      'Envia um erro de teste ao monitoramento. Só existe no app de desenvolvimento.',
      [
        {
          text: 'Enviar erro de teste',
          onPress: () => log.error('Teste de monitoramento — ignorar', new Error(MARCA_DO_TESTE)),
        },
        { text: 'Erro de tela', onPress: () => setErroDeTela(true) },
        { text: 'Travamento nativo', style: 'destructive', onPress: forceNativeCrash },
      ],
      { cancelable: true },
    );
  }, [visivel]);

  return { visivel, abrir, erroDeTela };
}

/** Componente que quebra de propósito ao renderizar (gatilho "Erro de tela"). */
export function ErroDeTelaProposital(): never {
  throw new Error(`${MARCA_DO_TESTE}_TELA`);
}
