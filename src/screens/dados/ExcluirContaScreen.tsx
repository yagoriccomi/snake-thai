import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ConfirmarExclusaoSheet } from '@/components/ConfirmarExclusaoSheet';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { useExportarMeusDados } from '@/hooks/useExportarMeusDados';
import { createLogger } from '@/lib/logger';
import type { DadosStackScreenProps } from '@/navigation/types';
import { fetchStudentPayments } from '@/services/payments.service';
import { deleteMyAccount } from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import { contarMensalidadesEmAberto } from '@/utils/payments';

const log = createLogger('ExcluirContaScreen');

/**
 * O titular exclui a própria conta (LGPD art. 18, VI).
 *
 * Explica antes o que acontece e sugere exportar os dados. A confirmação pede a
 * palavra EXCLUIR e a senha, conferida no servidor. Depois do sucesso, sai da
 * conta pelo caminho normal de logout — que também apaga do aparelho os
 * rascunhos de chamada.
 */
export function ExcluirContaScreen(_props: DadosStackScreenProps<'ExcluirConta'>): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { session, isAdmin, signOut } = useAuth();
  const exportar = useExportarMeusDados();

  const [folha, setFolha] = useState(false);
  const [mensalidadesEmAberto, setMensalidadesEmAberto] = useState<number | null>(null);

  const userId = session?.user.id;
  useEffect(() => {
    if (userId === undefined) return;
    fetchStudentPayments(userId, 'active')
      .then((pagamentos) => setMensalidadesEmAberto(contarMensalidadesEmAberto(pagamentos)))
      .catch((erro: unknown) => {
        log.warn('Não foi possível contar as mensalidades em aberto', erro);
        setMensalidadesEmAberto(null);
      });
  }, [userId]);

  const excluir = useCallback(
    async (senha: string) => {
      await deleteMyAccount(senha);
      setFolha(false);
      Alert.alert('Conta excluída', 'Seus dados pessoais foram apagados. Obrigado por ter treinado com a gente.');
      await signOut();
    },
    [signOut],
  );

  if (isAdmin) {
    return (
      <ScreenWrapper edges={['bottom']}>
        <AppText variant="body" style={styles.paragrafo}>
          Contas de administrador são removidas por outro administrador, depois de rebaixadas a aluno.
        </AppText>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <AppText variant="body" style={styles.paragrafo}>
          Você pode pedir a exclusão da sua conta a qualquer momento. Seus dados pessoais são apagados e você perde o
          acesso ao app.
        </AppText>

        <View style={styles.bloco}>
          <Ionicons name="archive-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.textoDoBloco}>
            Pagamentos e presenças continuam guardados, sem o seu nome: a academia é obrigada por lei a manter os
            registros financeiros.
          </Text>
        </View>

        <View style={styles.bloco}>
          <Ionicons name="download-outline" size={20} color={colors.primaryText} />
          <View style={styles.flex}>
            <Text style={styles.textoDoBloco}>Quer uma cópia dos seus dados antes? Exporte agora — depois não dá.</Text>
            <Button
              title="Exportar meus dados"
              variant="secondary"
              onPress={() => void exportar.exportar()}
              loading={exportar.exportando}
              style={styles.botaoDoBloco}
            />
            {exportar.erro !== null ? (
              <AppText variant="caption" color={colors.error} accessibilityLiveRegion="polite">
                {exportar.erro}
              </AppText>
            ) : null}
          </View>
        </View>

        <Button
          title="Excluir minha conta"
          variant="danger"
          onPress={() => setFolha(true)}
          accessibilityHint="Abre a confirmação da exclusão"
          style={styles.excluir}
        />
      </ScrollView>

      <ConfirmarExclusaoSheet
        visible={folha}
        onClose={() => setFolha(false)}
        modo="titular"
        mensalidadesEmAberto={mensalidadesEmAberto}
        onConfirmar={excluir}
      />
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    conteudo: { paddingTop: 16, paddingBottom: 32, gap: 16 },
    paragrafo: { marginTop: 16 },
    flex: { flex: 1, gap: 8 },
    bloco: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    textoDoBloco: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
    botaoDoBloco: { alignSelf: 'flex-start' },
    excluir: { marginTop: 8 },
  });
}
