import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';

const log = createLogger('DesistirDaTrocaSheet');

interface DesistirDaTrocaSheetProps {
  /** A aula da linha, para a pessoa saber de qual troca desiste. */
  descricao: string;
  onClose: () => void;
  /** Deve lançar em caso de falha; a folha mostra a frase e continua aberta. */
  onDesistir: () => Promise<void>;
}

/**
 * Confirma **Desistir da troca** (§ 9.4, T36): não tem volta, e a aprovada só
 * sai enquanto nenhuma das duas aulas começou (o banco confere).
 */
export function DesistirDaTrocaSheet({ descricao, onClose, onDesistir }: DesistirDaTrocaSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const desistir = async (): Promise<void> => {
    setEnviando(true);
    setErro(null);
    try {
      await onDesistir();
      onClose();
    } catch (falha) {
      log.warn('Desistência não aceita', falha);
      setErro(describeError(falha));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <BottomSheet visible onClose={enviando ? () => undefined : onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        Desistir da troca?
      </AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {`${descricao}. Você volta a ter a aula original, e a troca não pode ser retomada.`}
      </AppText>
      {erro !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityRole="alert">
          {erro}
        </AppText>
      ) : null}
      <View style={styles.acoes}>
        <Button title="Voltar" variant="secondary" onPress={onClose} disabled={enviando} style={styles.metade} />
        <Button
          title="Desistir da troca"
          variant="danger"
          onPress={() => void desistir()}
          loading={enviando}
          style={styles.metade}
        />
      </View>
    </BottomSheet>
  );
}

function makeStyles() {
  return StyleSheet.create({
    acoes: { flexDirection: 'row', gap: 12, marginTop: 4 },
    metade: { flex: 1 },
  });
}
