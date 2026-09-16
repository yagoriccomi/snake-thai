import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';

/** Palavra que a pessoa digita para confirmar: exclusão não tem volta. */
export const PALAVRA_DE_CONFIRMACAO = 'EXCLUIR';

interface ConfirmarExclusaoSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * `titular`: a própria conta, com senha. `administrador`: a conta de outra
   * pessoa (quem chama já é admin, conferido no servidor).
   */
  modo: 'titular' | 'administrador';
  /** Nome de quem terá a conta excluída (modo administrador). */
  nome?: string | null;
  /** Mensalidades em aberto ou vencidas; `null` enquanto não se sabe. */
  mensalidadesEmAberto: number | null;
  /** Deve lançar em caso de falha: a folha mostra a mensagem e continua aberta. */
  onConfirmar: (senha: string) => Promise<void>;
}

const APAGADO: readonly string[] = [
  'Nome, CPF, celular e data de nascimento',
  'Imagens dos comprovantes de pagamento',
  'Justificativas de falta (texto e anexo)',
  'Acesso ao aplicativo',
];

/**
 * Confirmação da exclusão de conta (LGPD art. 18, VI).
 *
 * Diz com clareza o que é apagado e o que fica — e por quê — antes de uma ação
 * sem volta. O botão só libera com a palavra digitada (e a senha, no modo
 * titular). É uma `BottomSheet`, não um `Modal`, por causa dos campos (ver
 * Portal.tsx).
 */
export function ConfirmarExclusaoSheet({
  visible,
  onClose,
  modo,
  nome,
  mensalidadesEmAberto,
  onConfirmar,
}: ConfirmarExclusaoSheetProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [palavra, setPalavra] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const titular = modo === 'titular';
  const liberado =
    palavra.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO && (!titular || senha !== '') && !enviando;

  const fechar = useCallback(() => {
    if (enviando) return;
    setPalavra('');
    setSenha('');
    setErro(null);
    onClose();
  }, [enviando, onClose]);

  const confirmar = useCallback(async () => {
    if (!liberado) return;
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar(senha);
    } catch (falha) {
      setErro(describeError(falha));
    } finally {
      setEnviando(false);
    }
  }, [liberado, onConfirmar, senha]);

  const titulo = titular ? 'Excluir minha conta' : `Excluir a conta de ${nome ?? 'este usuário'}`;

  return (
    <BottomSheet visible={visible} onClose={fechar}>
      <AppText variant="subtitle" accessibilityRole="header">
        {titulo}
      </AppText>

      <Text style={styles.secao}>É apagado</Text>
      {APAGADO.map((item) => (
        <View key={item} style={styles.item}>
          <Ionicons name="close-circle-outline" size={18} color={colors.error} />
          <Text style={styles.textoDoItem}>{item}</Text>
        </View>
      ))}

      <Text style={styles.secao}>Fica, sem ligação com a pessoa</Text>
      <View style={styles.item}>
        <Ionicons name="archive-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.textoDoItem}>
          Pagamentos e presenças. A academia é obrigada por lei a guardar os registros financeiros.
        </Text>
      </View>

      {mensalidadesEmAberto !== null && mensalidadesEmAberto > 0 ? (
        <View style={styles.aviso} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          <Text style={styles.textoDoItem}>
            {mensalidadesEmAberto === 1
              ? 'Há 1 mensalidade em aberto. Excluir a conta não quita o débito.'
              : `Há ${mensalidadesEmAberto} mensalidades em aberto. Excluir a conta não quita os débitos.`}
          </Text>
        </View>
      ) : null}

      <Input
        label={`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar`}
        value={palavra}
        onChangeText={setPalavra}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!enviando}
      />
      {titular ? (
        <Input
          label="Sua senha atual"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoCapitalize="none"
          editable={!enviando}
        />
      ) : null}

      {erro !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityLiveRegion="polite">
          {erro}
        </AppText>
      ) : null}

      <Button
        title="Excluir conta"
        variant="danger"
        onPress={() => void confirmar()}
        disabled={!liberado}
        loading={enviando}
        accessibilityHint="Exclui a conta de forma definitiva"
      />
      <Button title="Cancelar" variant="secondary" onPress={fechar} disabled={enviando} />
    </BottomSheet>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    secao: {
      marginTop: 6,
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    textoDoItem: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
    aviso: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.warning,
    },
  });
}
