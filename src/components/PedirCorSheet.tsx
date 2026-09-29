import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CampoDeCor } from '@/components/CampoDeCor';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/ThemeProvider';
import { MENSAGEM_COR_INVALIDA, ehCorValida } from '@/utils/cor';
import { describeError } from '@/utils/errors';

const log = createLogger('PedirCorSheet');

export const TEXTOS_DA_FOLHA_DE_COR = {
  titulo: 'Escolha a sua cor',
  explicacao:
    'Para entrar na aula você precisa de uma cor. Ela aparece ao lado do seu nome e na borda das aulas que você dá. Dá para trocar depois em Dados › Minha cor.',
  confirmar: 'Salvar e entrar',
  cancelar: 'Cancelar',
} as const;

interface PedirCorSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Salva a cor e entra na aula. Deve lançar em caso de falha: a folha mostra a mensagem e fica aberta. */
  onConfirmar: (cor: string) => Promise<void>;
}

/**
 * Pede a cor ao admin que ainda não tem uma, antes de entrar numa aula (T24).
 * O trilho de cor das aulas depende dela; sem cor, o banco recusaria o vínculo.
 */
export function PedirCorSheet({ visible, onClose, onConfirmar }: PedirCorSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const [cor, setCor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const fechar = useCallback(() => {
    if (enviando) return;
    setCor('');
    setErro(null);
    onClose();
  }, [enviando, onClose]);

  const confirmar = useCallback(async () => {
    const valor = cor.trim().toUpperCase();
    if (!ehCorValida(valor)) {
      setErro(MENSAGEM_COR_INVALIDA);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await onConfirmar(valor);
      setCor('');
    } catch (falha) {
      log.warn('Falha ao salvar a cor e entrar na aula', falha);
      setErro(describeError(falha));
    } finally {
      setEnviando(false);
    }
  }, [cor, onConfirmar]);

  return (
    <BottomSheet visible={visible} onClose={fechar}>
      <AppText variant="subtitle" accessibilityRole="header">
        {TEXTOS_DA_FOLHA_DE_COR.titulo}
      </AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {TEXTOS_DA_FOLHA_DE_COR.explicacao}
      </AppText>
      <CampoDeCor
        label="Cor hexadecimal"
        value={cor}
        onChangeText={(valor) => {
          setErro(null);
          setCor(valor);
        }}
        error={erro ?? undefined}
        containerStyle={styles.campo}
      />
      <View style={styles.acoes}>
        <Button
          title={TEXTOS_DA_FOLHA_DE_COR.cancelar}
          variant="secondary"
          onPress={fechar}
          disabled={enviando}
          style={styles.botao}
        />
        <Button
          title={TEXTOS_DA_FOLHA_DE_COR.confirmar}
          onPress={() => void confirmar()}
          loading={enviando}
          style={styles.botao}
          accessibilityHint="Salva a sua cor e inclui você como um dos professores desta aula"
        />
      </View>
    </BottomSheet>
  );
}

function makeStyles() {
  return StyleSheet.create({
    campo: {
      marginTop: 4,
    },
    acoes: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    botao: {
      flex: 1,
    },
  });
}
