import React, { useCallback, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/ThemeProvider';
import { linkDoEmail, linkDoWhatsapp, type ContatoDaAcademia } from '@/utils/contato';

const log = createLogger('BotoesDeContato');

export const FALHA_AO_ABRIR = {
  whatsapp: 'Não foi possível abrir o WhatsApp.',
  email: 'Não foi possível abrir o seu app de e-mail.',
} as const;

interface BotoesDeContatoProps {
  contato: ContatoDaAcademia;
  /** `empilhados`: a folha "Falar com a academia" (WhatsApp em destaque). `lado-a-lado`: o bloco dos negados. */
  arranjo: 'empilhados' | 'lado-a-lado';
}

/**
 * Os botões **WhatsApp** e **E-mail** da academia (§ 5.4), só os preenchidos.
 * O app só abre os dois links montados pelo contrato (`wa.me` e `mailto:`), e
 * a falha ao abrir é dita na tela, além de ir para o log [#93].
 */
export function BotoesDeContato({ contato, arranjo }: BotoesDeContatoProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const [falha, setFalha] = useState<string | null>(null);

  const abrir = useCallback((url: string, mensagemDeFalha: string) => {
    setFalha(null);
    Linking.openURL(url).catch((erro: unknown) => {
      log.warn('Falha ao abrir o contato da academia', erro);
      setFalha(mensagemDeFalha);
    });
  }, []);

  const ladoALado = arranjo === 'lado-a-lado';
  const { whatsapp, email } = contato;

  return (
    <View style={styles.bloco}>
      <View style={ladoALado ? styles.linha : styles.coluna}>
        {whatsapp !== null ? (
          <Button
            title="WhatsApp"
            variant={ladoALado ? 'secondary' : 'primary'}
            onPress={() => abrir(linkDoWhatsapp(whatsapp), FALHA_AO_ABRIR.whatsapp)}
            style={ladoALado ? styles.metade : null}
            accessibilityHint="Abre a conversa com a academia no WhatsApp"
          />
        ) : null}
        {email !== null ? (
          <Button
            title="E-mail"
            variant="secondary"
            onPress={() => abrir(linkDoEmail(email), FALHA_AO_ABRIR.email)}
            style={ladoALado ? styles.metade : null}
            accessibilityHint="Abre o seu app de e-mail com o endereço da academia"
          />
        ) : null}
      </View>
      {falha !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityRole="alert">
          {falha}
        </AppText>
      ) : null}
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    bloco: {
      gap: 8,
    },
    coluna: {
      gap: 10,
    },
    linha: {
      flexDirection: 'row',
      gap: 10,
    },
    metade: {
      flex: 1,
    },
  });
}
