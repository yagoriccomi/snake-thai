import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { parseLegalText, type BlocoDeTextoLegal } from '@/utils/legalText';

interface LegalDocumentTextProps {
  conteudo: string;
}

/**
 * Texto de um documento legal (Política de Privacidade, Termos de Uso).
 *
 * Renderiza tudo de uma vez, sem lista virtualizada: são ~100 blocos lidos em
 * sequência, e o TalkBack percorre o texto inteiro melhor assim. Títulos são
 * `header`, para quem navega por cabeçalhos pular de seção em seção.
 */
function LegalDocumentTextComponent({ conteudo }: LegalDocumentTextProps): React.JSX.Element {
  const blocos = useMemo(() => parseLegalText(conteudo), [conteudo]);

  return (
    <View style={styles.container}>
      {blocos.map((bloco, indice) => (
        // O texto publicado não muda (versão nova é outro documento): índice é estável.
        <Bloco key={indice} bloco={bloco} />
      ))}
    </View>
  );
}

function Bloco({ bloco }: { bloco: BlocoDeTextoLegal }): React.JSX.Element {
  switch (bloco.tipo) {
    case 'titulo':
      return (
        <AppText variant="heading" accessibilityRole="header" style={styles.titulo}>
          {bloco.texto}
        </AppText>
      );
    case 'secao':
      return (
        <AppText variant="subtitle" accessibilityRole="header" style={styles.secao}>
          {bloco.texto}
        </AppText>
      );
    case 'item':
      return (
        <View style={styles.item}>
          <AppText variant="body" importantForAccessibility="no" accessibilityElementsHidden style={styles.marcador}>
            •
          </AppText>
          <AppText variant="body" style={styles.textoDoItem}>
            {bloco.texto}
          </AppText>
        </View>
      );
    case 'paragrafo':
    default:
      return (
        <AppText variant="body" style={styles.paragrafo}>
          {bloco.texto}
        </AppText>
      );
  }
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  titulo: {
    marginBottom: 4,
  },
  secao: {
    marginTop: 14,
  },
  paragrafo: {
    lineHeight: 24,
  },
  item: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 4,
  },
  marcador: {
    lineHeight: 24,
  },
  textoDoItem: {
    flex: 1,
    lineHeight: 24,
  },
});

export const LegalDocumentText = React.memo(LegalDocumentTextComponent);
