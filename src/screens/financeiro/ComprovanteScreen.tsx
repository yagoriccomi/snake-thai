import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import {
  approvePayment,
  createSignedProofUrl,
  rejectPayment,
} from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';

const SCREEN_EDGES = ['bottom'] as const;

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
   * O identificador do arquivo muda conforme o provedor: path no Storage
   * (com extensao) ou public_id na Cloudinary (sem extensao). Para o legado a
   * extensao ainda diz se e PDF; na Cloudinary ela nao existe, e o visualizador
   * recebe a URL assinada, que a Cloudinary entrega com o tipo correto.
   */
  const referenciaDoArquivo =
    comprovante.proof_storage_path ?? comprovante.proof_url ?? comprovante.proof_public_id;
  const temComprovante = referenciaDoArquivo !== null;
  const isPdf = referenciaDoArquivo?.toLowerCase().endsWith('.pdf') ?? false;

  useEffect(() => {
    let active = true;
    if (!temComprovante) {
      setLoadingUrl(false);
      return;
    }
    createSignedProofUrl(comprovante)
      .then((url) => {
        if (active) {
          setSignedUrl(url);
        }
      })
      .catch(() => {
        if (active) {
          setSignedUrl(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingUrl(false);
        }
      });
    return () => {
      active = false;
    };
  }, [comprovante, temComprovante]);

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
            <ActivityIndicator size="large" color={colors.primary} />
          ) : signedUrl === null ? (
            <AppText variant="caption" color={colors.textSecondary}>
              Comprovante indisponível.
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
