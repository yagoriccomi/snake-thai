import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { LegalDocumentText } from '@/components/LegalDocumentText';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import type { DocumentoLegalVigente } from '@/services/legalDocuments.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { descreverVersaoDoDocumento } from '@/utils/legalText';

interface LegalDocumentModalProps {
  /** Documento aberto; `null` fecha. */
  documento: DocumentoLegalVigente | null;
  onClose: () => void;
}

/**
 * Leitura de um documento legal em tela cheia, por cima do onboarding ou da
 * tela de aceite (que vivem fora das stacks). Fecha pelo X ou pelo voltar do
 * Android.
 */
function LegalDocumentModalComponent({ documento, onClose }: LegalDocumentModalProps): React.JSX.Element {
  const { colors, minHitSlop } = useTheme();
  const styles = useMemo(() => makeStyles(colors, minHitSlop), [colors, minHitSlop]);
  // Mantém o texto durante a animação de saída, quando `documento` já é nulo.
  const [exibido, setExibido] = useState<DocumentoLegalVigente | null>(documento);

  useEffect(() => {
    if (documento !== null) setExibido(documento);
  }, [documento]);

  return (
    <Modal visible={documento !== null} animationType="slide" onRequestClose={onClose}>
      <ScreenWrapper>
        <View style={styles.topo}>
          <AppText variant="caption" style={styles.versao}>
            {exibido === null ? '' : descreverVersaoDoDocumento(exibido)}
          </AppText>
          <Pressable
            onPress={onClose}
            style={styles.fechar}
            accessibilityRole="button"
            accessibilityLabel="Fechar documento"
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator>
          {exibido === null ? null : <LegalDocumentText conteudo={exibido.conteudo} />}
        </ScrollView>
      </ScreenWrapper>
    </Modal>
  );
}

function makeStyles(colors: ColorScheme, minHitSlop: number) {
  return StyleSheet.create({
    topo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    versao: {
      flex: 1,
    },
    fechar: {
      minWidth: minHitSlop,
      minHeight: minHitSlop,
      alignItems: 'center',
      justifyContent: 'center',
    },
    conteudo: {
      paddingTop: 16,
      paddingBottom: 32,
    },
  });
}

export const LegalDocumentModal = React.memo(LegalDocumentModalComponent);
