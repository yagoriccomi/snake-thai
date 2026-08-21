import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAcademySettings } from '@/hooks/useAcademySettings';
import { useAuth } from '@/context/AuthProvider';
import type { FinanceiroStackScreenProps } from '@/navigation/types';
import {
  pickDocumentProof,
  pickImageProof,
  type PickedFile,
} from '@/services/filePicker.service';
import { submitProof } from '@/services/payments.service';
import { useTheme } from '@/theme/ThemeProvider';
import { dateIsoToBr } from '@/utils/masks';

const SCREEN_EDGES = ['bottom'] as const;

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

  const handlePick = useCallback(
    async (picker: () => Promise<PickedFile | null>) => {
      const userId = session?.user.id;
      if (userId === undefined) {
        return;
      }
      setError(null);
      const file = await picker();
      if (file === null) {
        return;
      }
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
      } catch {
        setError('Não foi possível enviar o comprovante. Tente novamente.');
      } finally {
        setSubmitting(false);
      }
    },
    [session, paymentId],
  );

  const handlePickImage = useCallback(() => {
    void handlePick(pickImageProof);
  }, [handlePick]);

  const handlePickDocument = useCallback(() => {
    void handlePick(pickDocumentProof);
  }, [handlePick]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

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
          loading={submitting}
          style={styles.button}
        />
        <Button
          title="Enviar PDF"
          variant="secondary"
          onPress={handlePickDocument}
          disabled={submitting}
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
