import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { WaitingState } from '@/components/WaitingState';
import { preAquecer } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import {
  approvePayment,
  createSignedProofUrl,
  rejectPayment,
} from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';

const SCREEN_EDGES = ['bottom'] as const;

const log = createLogger('ComprovanteScreen');

const ABRINDO = 'Abrindo o comprovante…';
const ABERTURA_DEMORADA =
  'O servidor está sendo iniciado. A primeira consulta depois de um tempo ' +
  'parado pode levar até um minuto.';
const FALHA_AO_ABRIR =
  'Não conseguimos carregar o comprovante agora. O arquivo continua salvo — ' +
  'isso é uma falha de conexão com o servidor, não um envio faltando.';

/**
 * Validação do comprovante (admin): exibe o arquivo (imagem inline ou PDF via
 * navegador) e permite Aprovar (→ paid) ou Recusar (apaga o arquivo, volta a open).
 */
export function ComprovanteScreen({
  route,
  navigation,
}: FinanceiroStackScreenProps<'Comprovante'>): React.JSX.Element {
  const { colors } = useTheme();
  const { paymentId, comprovante, studentName } = route.params;

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [working, setWorking] = useState(false);
  /**
   * Separado de `signedUrl === null` DE PROPÓSITO. Antes, falha de rede e
   * "o aluno não enviou nada" produziam a MESMA tela — e o admin lia a falha
   * do servidor como ausência de comprovante. Informação errada apresentada
   * com confiança é pior do que erro visível. [#93]
   */
  const [falhouAoCarregar, setFalhouAoCarregar] = useState(false);
  /** Muda para forçar a recarga quando o admin toca em "tentar de novo". */
  const [tentativa, setTentativa] = useState(0);

  /**
   * O identificador do arquivo muda conforme o provedor: path no Storage
   * (com extensao) ou public_id na Cloudinary (sem extensao). Para o legado a
   * extensao ainda diz se e PDF; na Cloudinary ela nao existe, e o visualizador
   * recebe a URL assinada, que a Cloudinary entrega com o tipo correto.
   */
  const referenciaDoArquivo =
    comprovante.proof_storage_path ?? comprovante.proof_url ?? comprovante.proof_public_id;
  const temComprovante = referenciaDoArquivo !== null;
  const isPdf = referenciaDoArquivo?.toLowerCase().endsWith('.pdf') ?? false;

  /** Acorda o servidor assim que a tela abre — `docs/BACKEND.md` §5. */
  useEffect(() => {
    preAquecer();
  }, []);

  useEffect(() => {
    let active = true;
    if (!temComprovante) {
      setLoadingUrl(false);
      return;
    }
    setLoadingUrl(true);
    setFalhouAoCarregar(false);
    createSignedProofUrl(comprovante)
      .then((url) => {
        if (active) {
          setSignedUrl(url);
        }
      })
      .catch((erro: unknown) => {
        if (!active) {
          return;
        }
        log.error('Falha ao gerar URL do comprovante', {
          paymentId,
          provedor: comprovante.proof_provider,
          motivo: erro instanceof Error ? erro.message : 'desconhecido',
        });
        setSignedUrl(null);
        setFalhouAoCarregar(true);
      })
      .finally(() => {
        if (active) {
          setLoadingUrl(false);
        }
      });
    return () => {
      active = false;
    };
  }, [comprovante, temComprovante, paymentId, tentativa]);

  const handleRetryUrl = useCallback(() => {
    setTentativa((anterior) => anterior + 1);
  }, []);

  const handleApprove = useCallback(async () => {
    setWorking(true);
    try {
      await approvePayment(paymentId);
      navigation.goBack();
    } catch {
      Alert.alert('Erro', 'Não foi possível aprovar o pagamento.');
    } finally {
      setWorking(false);
    }
  }, [paymentId, navigation]);

  const confirmReject = useCallback(async () => {
    setWorking(true);
    try {
      await rejectPayment(comprovante);
      navigation.goBack();
    } catch {
      Alert.alert('Erro', 'Não foi possível recusar o comprovante.');
    } finally {
      setWorking(false);
    }
  }, [comprovante, navigation]);

  const handleReject = useCallback(() => {
    Alert.alert(
      'Recusar comprovante',
      `O comprovante de ${studentName} será apagado e a mensalidade voltará para "Em aberto". Notifique o aluno.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Recusar', style: 'destructive', onPress: () => void confirmReject() },
      ],
    );
  }, [studentName, confirmReject]);

  const openPdf = useCallback(() => {
    if (signedUrl !== null) {
      void Linking.openURL(signedUrl);
    }
  }, [signedUrl]);

  return (
    <ScreenWrapper edges={SCREEN_EDGES}>
      <View style={styles.body}>
        <AppText variant="subtitle">{studentName}</AppText>

        <View style={styles.preview}>
          {loadingUrl ? (
            <WaitingState message={ABRINDO} longWaitMessage={ABERTURA_DEMORADA} />
          ) : falhouAoCarregar ? (
            <ErrorState
              message={FALHA_AO_ABRIR}
              onRetry={handleRetryUrl}
              retryLabel="Tentar de novo"
            />
          ) : signedUrl === null ? (
            <AppText variant="caption" color={colors.textSecondary}>
              Este pagamento ainda não tem comprovante enviado.
            </AppText>
          ) : isPdf ? (
            <Button title="Abrir comprovante (PDF)" onPress={openPdf} />
          ) : (
            <Image
              source={{ uri: signedUrl }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel="Comprovante de pagamento"
            />
          )}
        </View>

        <Button
          title="Aprovar Pagamento"
          onPress={handleApprove}
          loading={working}
          style={styles.button}
        />
        <Button
          title="Recusar Comprovante"
          variant="secondary"
          onPress={handleReject}
          disabled={working}
          style={styles.button}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 16,
  },
  preview: {
    flex: 1,
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  button: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
});
