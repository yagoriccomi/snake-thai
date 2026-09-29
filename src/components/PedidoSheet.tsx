import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { TEXTO_MAXIMO } from '@/constants/solicitacoes';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';

const log = createLogger('PedidoSheet');

export const PEDIDO_ENVIADO = 'Pedido enviado. Acompanhe a resposta em Meus pedidos.';

interface PedidoSheetProps {
  visible: boolean;
  titulo: string;
  /** A aula e o que acontece se for aprovado. */
  contexto: string;
  onClose: () => void;
  /** Deve lançar em caso de falha; a folha mostra a frase e continua aberta. */
  onEnviar: (texto: string) => Promise<void>;
}

/**
 * Um pedido da § 9.3 ("Eu estava na aula", os pedidos ao admin): o motivo é
 * obrigatório e vai uma vez só (T19, sem reenvio). Anexos depois do G2.
 */
export function PedidoSheet({ visible, titulo, contexto, onClose, onEnviar }: PedidoSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTexto('');
      setErro(null);
      setEnviado(false);
    }
  }, [visible]);

  const enviar = async (): Promise<void> => {
    setEnviando(true);
    setErro(null);
    try {
      await onEnviar(texto);
      setEnviado(true);
    } catch (falha) {
      log.warn('Pedido não enviado', falha);
      setErro(describeError(falha));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={enviando ? () => undefined : onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        {titulo}
      </AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {contexto}
      </AppText>
      {enviado ? (
        <>
          <AppText variant="body" accessibilityRole="alert">
            {PEDIDO_ENVIADO}
          </AppText>
          <Button title="Fechar" variant="secondary" onPress={onClose} />
        </>
      ) : (
        <>
          <Input
            label="Motivo (obrigatório)"
            value={texto}
            onChangeText={setTexto}
            multiline
            maxLength={TEXTO_MAXIMO}
            placeholder="Conte o que aconteceu."
          />
          <AppText variant="caption" color={colors.textSecondary}>
            O pedido vai uma vez só, em até 7 dias depois da aula.
          </AppText>
          {erro !== null ? (
            <AppText variant="caption" color={colors.error} accessibilityRole="alert">
              {erro}
            </AppText>
          ) : null}
          <View style={styles.acoes}>
            <Button title="Voltar" variant="secondary" onPress={onClose} disabled={enviando} style={styles.metade} />
            <Button
              title="Enviar pedido"
              onPress={() => void enviar()}
              loading={enviando}
              disabled={texto.trim() === ''}
              style={styles.metade}
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

function makeStyles() {
  return StyleSheet.create({
    acoes: { flexDirection: 'row', gap: 12, marginTop: 4 },
    metade: { flex: 1 },
  });
}
