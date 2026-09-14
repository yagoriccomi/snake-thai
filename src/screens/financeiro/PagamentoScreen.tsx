import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { WaitingState } from '@/components/WaitingState';
import { useAcademySettings } from '@/hooks/useAcademySettings';
import { useAuth } from '@/context/AuthProvider';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import {
  pickDocumentProof,
  pickImageProof,
  type PickedFile,
} from '@/services/filePicker.service';
import { preAquecer } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { submitProof } from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';
import { dateIsoToBr } from '@/utils/masks';

const SCREEN_EDGES = ['bottom'] as const;

const log = createLogger('PagamentoScreen');

/** Mensagens da espera. Fora do JSX para não virar texto solto no meio da view. [#3] */
const ENVIANDO = 'Enviando seu comprovante…';
const ENVIO_DEMORADO =
  'O servidor está sendo iniciado. Isso pode levar até um minuto na primeira ' +
  'vez do dia — pode deixar a tela aberta.';
const FALHA_NO_ENVIO =
  'Não conseguimos enviar seu comprovante. Ele continua salvo aqui: toque em ' +
  'tentar de novo.';

/**
 * Fluxo de pagamento PIX (aluno): exibe a chave da academia e permite anexar o
 * comprovante (imagem ou PDF). No sucesso, o pagamento vai para "Em análise".
 */
export function PagamentoScreen({
  route,
  navigation,
}: FinanceiroStackScreenProps<'Pagamento'>): React.JSX.Element {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { settings } = useAcademySettings();
  const { paymentId, dueDate } = route.params;

  // A chave PIX vive na configuracao da academia, editavel pelo admin. Enquanto
  // ela nao carrega (ou nao foi preenchida), avisamos em vez de exibir vazio.
  const pixKey = settings?.pix_key ?? 'Chave PIX nao configurada';

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * O arquivo já escolhido fica guardado para o "tentar de novo" reenviar o
   * MESMO comprovante. Obrigar alguém a procurar o arquivo outra vez porque o
   * servidor estava hibernando é cobrar do usuário um problema nosso. [#98]
   */
  const [arquivoEscolhido, setArquivoEscolhido] = useState<PickedFile | null>(null);

  /**
   * Acorda o servidor assim que a tela abre — `docs/BACKEND.md` §5.
   * Enquanto o aluno lê a chave PIX, abre o app do banco e paga, o contêiner
   * sobe. Quando ele volta para anexar o comprovante, o cold start já passou.
   */
  useEffect(() => {
    preAquecer();
  }, []);

  const enviar = useCallback(
    async (file: PickedFile) => {
      const userId = session?.user.id;
      if (userId === undefined) {
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        await submitProof({
          userId,
          paymentId,
          fileUri: file.uri,
          fileName: file.name,
          contentType: file.contentType,
          base64: file.base64,
        });
        setDone(true);
      } catch (erro) {
        // O detalhe técnico vai para o log; a tela recebe só o que a pessoa
        // consegue entender e resolver. Nunca a stack. [#92][#93]
        log.error('Falha ao enviar comprovante', erro, { paymentId });
        setError(FALHA_NO_ENVIO);
      } finally {
        setSubmitting(false);
      }
    },
    [session, paymentId],
  );

  const handlePick = useCallback(
    async (picker: () => Promise<PickedFile | null>) => {
      setError(null);
      const file = await picker();
      if (file === null) {
        return;
      }
      setArquivoEscolhido(file);
      await enviar(file);
    },
    [enviar],
  );

  const handleRetry = useCallback(() => {
    if (arquivoEscolhido === null) {
      return;
    }
    void enviar(arquivoEscolhido);
  }, [arquivoEscolhido, enviar]);

  const handlePickImage = useCallback(() => {
    void handlePick(pickImageProof);
  }, [handlePick]);

  const handlePickDocument = useCallback(() => {
    void handlePick(pickDocumentProof);
  }, [handlePick]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  // Early returns dos estados que tomam a tela inteira, antes do caminho
  // feliz — evita aninhar a view principal dentro de condicionais. [#9]
  if (submitting) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <WaitingState message={ENVIANDO} longWaitMessage={ENVIO_DEMORADO} />
      </ScreenWrapper>
    );
  }

  if (error !== null && arquivoEscolhido !== null) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <ErrorState message={error} onRetry={handleRetry} retryLabel="Tentar de novo" />
      </ScreenWrapper>
    );
  }

  if (done) {
    return (
      <ScreenWrapper edges={SCREEN_EDGES}>
        <View style={styles.center}>
          <AppText variant="heading">Comprovante enviado ✅</AppText>
          <AppText variant="caption" style={styles.centered}>
            Seu pagamento está <AppText variant="caption" color={colors.info}>
              em análise
            </AppText>
            . Você será notificado após a aprovação.
          </AppText>
          <Button title="Voltar" onPress={handleBack} style={styles.button} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <View style={styles.body}>
        <AppText variant="caption">Vencimento: {dateIsoToBr(dueDate)}</AppText>

        <View style={[styles.pixBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <AppText variant="label">Chave PIX da academia</AppText>
          <AppText variant="subtitle" color={colors.primaryText} style={styles.pixKey}>
            {pixKey}
          </AppText>
          <AppText variant="caption">
            Pague pelo app do seu banco e anexe o comprovante abaixo.
          </AppText>
        </View>

        <AppText variant="subtitle" style={styles.section}>
          Anexar comprovante
        </AppText>
        <Button
          title="Enviar imagem (JPG/PNG)"
          onPress={handlePickImage}
          style={styles.button}
        />
        <Button
          title="Enviar PDF"
          variant="secondary"
          onPress={handlePickDocument}
          style={styles.button}
        />

        {error !== null ? (
          <AppText variant="caption" color={colors.error} style={styles.section}>
            {error}
          </AppText>
        ) : null}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  centered: {
    textAlign: 'center',
  },
  pixBox: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    gap: 6,
  },
  pixKey: {
    marginVertical: 2,
  },
  section: {
    marginTop: 20,
  },
  button: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
});
