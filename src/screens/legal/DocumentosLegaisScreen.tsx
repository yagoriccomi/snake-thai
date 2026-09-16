import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LegalDocumentText } from '@/components/LegalDocumentText';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { SegmentedControl, type SegmentOption } from '@/components/SegmentedControl';
import { ROTULO_CURTO_DO_DOCUMENTO, type TipoDeDocumentoLegal } from '@/constants/legal';
import { useLegalDocuments } from '@/hooks/useLegalDocuments';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { descreverAceite, descreverVersaoDoDocumento } from '@/utils/legalText';

const EDGES = ['bottom'] as const;

/**
 * Perfil → Termos e privacidade: a versão vigente de cada documento, quando
 * foi publicada e quando a pessoa aceitou (LGPD art. 9º: informação clara e
 * acessível a qualquer momento).
 */
export function DocumentosLegaisScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { documentos, carregando, erro, recarregar } = useLegalDocuments();
  const [tipo, setTipo] = useState<TipoDeDocumentoLegal>('privacy_policy');

  const opcoes = useMemo<SegmentOption<TipoDeDocumentoLegal>[]>(
    () => documentos.map((documento) => ({ value: documento.tipo, label: ROTULO_CURTO_DO_DOCUMENTO[documento.tipo] })),
    [documentos],
  );
  const selecionado = documentos.find((documento) => documento.tipo === tipo) ?? documentos[0];

  if (carregando) {
    return (
      <ScreenWrapper edges={EDGES}>
        <View style={styles.centro} accessible accessibilityLabel="Carregando os documentos">
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (erro !== null) {
    return (
      <ScreenWrapper edges={EDGES}>
        <View style={styles.centro}>
          <AppText variant="body" color={colors.error} style={styles.textoCentral} accessibilityLiveRegion="polite">
            {erro}
          </AppText>
          <Button title="Tentar de novo" variant="secondary" onPress={() => void recarregar()} />
        </View>
      </ScreenWrapper>
    );
  }

  if (selecionado === undefined) {
    return (
      <ScreenWrapper edges={EDGES}>
        <View style={styles.centro}>
          <Ionicons name="document-text-outline" size={36} color={colors.textSecondary} />
          <AppText variant="body" color={colors.textSecondary} style={styles.textoCentral}>
            A academia ainda não publicou a Política de Privacidade e os Termos de Uso no app.
          </AppText>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={EDGES}>
      {opcoes.length > 1 ? (
        <View style={styles.abas}>
          <SegmentedControl options={opcoes} value={selecionado.tipo} onChange={setTipo} />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.conteudo}>
        <View style={styles.situacao} accessible>
          <AppText variant="caption">{descreverVersaoDoDocumento(selecionado)}</AppText>
          <AppText variant="caption" color={selecionado.aceitoEm === null ? colors.warning : colors.textSecondary}>
            {descreverAceite(selecionado.aceitoEm)}
          </AppText>
        </View>
        <LegalDocumentText conteudo={selecionado.conteudo} />
      </ScrollView>
    </ScreenWrapper>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    centro: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingHorizontal: 8,
    },
    textoCentral: {
      textAlign: 'center',
    },
    abas: {
      paddingTop: 8,
      paddingBottom: 4,
    },
    conteudo: {
      paddingTop: 12,
      paddingBottom: 32,
      gap: 16,
    },
    situacao: {
      gap: 2,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
  });
}
