import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ACAO_DE_LER_O_DOCUMENTO, TITULO_DO_DOCUMENTO } from '@/constants/legal';
import type { Fonts } from '@/constants/theme';
import type { DocumentoLegalVigente } from '@/services/legalDocuments.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { descreverVersaoDoDocumento } from '@/utils/legalText';

interface LegalDocumentLinksProps {
  documentos: readonly DocumentoLegalVigente[];
  onLer: (documento: DocumentoLegalVigente) => void;
  /**
   * Mostra nome, versão e data (tela de novo aceite, onde a versão é a
   * novidade). Sem ela, a linha é só "Ler a Política de Privacidade".
   */
  mostrarVersao?: boolean;
}

/** Cartão com uma linha por documento, que abre o texto completo. */
function LegalDocumentLinksComponent({
  documentos,
  onLer,
  mostrarVersao = false,
}: LegalDocumentLinksProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={styles.card}>
      {documentos.map((documento, indice) => {
        const rotulo = mostrarVersao ? TITULO_DO_DOCUMENTO[documento.tipo] : ACAO_DE_LER_O_DOCUMENTO[documento.tipo];
        const versao = descreverVersaoDoDocumento(documento);
        return (
          <Pressable
            key={documento.id}
            onPress={() => onLer(documento)}
            style={[styles.linha, indice < documentos.length - 1 ? styles.divisoria : null]}
            accessibilityRole="button"
            accessibilityLabel={mostrarVersao ? `${ACAO_DE_LER_O_DOCUMENTO[documento.tipo]}, ${versao}` : rotulo}
            accessibilityHint="Abre o texto completo"
          >
            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
            <View style={styles.textos}>
              <Text style={styles.rotulo}>{rotulo}</Text>
              {mostrarVersao ? <Text style={styles.versao}>{versao}</Text> : null}
            </View>
            {mostrarVersao ? <Text style={styles.ler}>Ler</Text> : null}
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: 'hidden',
    },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 52,
    },
    divisoria: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    textos: {
      flex: 1,
      gap: 2,
    },
    rotulo: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    versao: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
    ler: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: colors.primaryText,
    },
  });
}

export const LegalDocumentLinks = React.memo(LegalDocumentLinksComponent);
