import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useTheme } from '@/theme/ThemeProvider';
import { rotuloDoEstado, type EstadoNaChamada, type MudancaDeAluno, type MudancaDeProfessor } from '@/utils/chamada';

/** O motivo aceito pelo banco (§ 8, `action_reasons_texto_valido`). */
const MOTIVO_MAXIMO = 500;

interface RetificarChamadaSheetProps {
  visible: boolean;
  alunos: readonly MudancaDeAluno[];
  professores: readonly MudancaDeProfessor[];
  salvando: boolean;
  /** Recusa do banco, já em frase para a pessoa. */
  erro: string | null;
  onSalvar: (motivo: string) => void;
  onClose: () => void;
}

/**
 * A folha Retificar (D17–D21, mockup da linha C): toda mudança depois de
 * salvar é retificação, com o motivo obrigatório. Os anexos entram quando as
 * rotas do servidor forem publicadas (G2); até lá, só o texto.
 */
export function RetificarChamadaSheet({
  visible,
  alunos,
  professores,
  salvando,
  erro,
  onSalvar,
  onClose,
}: RetificarChamadaSheetProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [motivo, setMotivo] = useState('');
  const total = alunos.length + professores.length;
  const valido = motivo.trim().length > 0;

  useEffect(() => {
    if (!visible) setMotivo('');
  }, [visible]);

  const corDoEstado = (estado: EstadoNaChamada | boolean | null): string => {
    if (estado === 'present' || estado === true) return colors.success;
    if (estado === 'absent' || estado === false) return colors.error;
    return colors.textSecondary;
  };
  const rotuloDoProfessor = (presente: boolean | null): string =>
    presente === null ? 'Sem registro' : presente ? 'Deu a aula' : 'Não deu a aula';

  return (
    <BottomSheet visible={visible} onClose={salvando ? () => undefined : onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        Retificar chamada
      </AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        Toda mudança depois de salvar é retificação. Só admins veem o motivo e quem editou; o aluno e o professor veem a
        marca Editada. O aluno afetado é avisado.
      </AppText>
      <Text style={styles.overline}>{`ALTERAÇÕES (${total})`}</Text>
      {alunos.map((mudanca) => (
        <View
          key={mudanca.userId}
          style={styles.mudanca}
          accessible
          accessibilityLabel={`${mudanca.nome}: de ${rotuloDoEstado(mudanca.antes)} para ${rotuloDoEstado(mudanca.depois)}`}
        >
          <Text style={styles.nome} numberOfLines={1}>
            {mudanca.nome}
          </Text>
          <Text style={[styles.estado, { color: corDoEstado(mudanca.antes) }]}>{rotuloDoEstado(mudanca.antes)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          <Text style={[styles.estado, { color: corDoEstado(mudanca.depois) }]}>{rotuloDoEstado(mudanca.depois)}</Text>
        </View>
      ))}
      {professores.map((mudanca) => (
        <View key={mudanca.teacherId} style={styles.mudanca}>
          <Text style={styles.nome} numberOfLines={1}>
            {mudanca.nome}
          </Text>
          <Text style={[styles.estado, { color: corDoEstado(mudanca.antes) }]}>{rotuloDoProfessor(mudanca.antes)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          <Text style={[styles.estado, { color: corDoEstado(mudanca.depois) }]}>{rotuloDoProfessor(mudanca.depois)}</Text>
        </View>
      ))}
      <Input
        label="Motivo (obrigatório)"
        value={motivo}
        onChangeText={setMotivo}
        multiline
        maxLength={MOTIVO_MAXIMO}
        placeholder="Ex.: o aluno estava na aula; marquei errado ao fechar a chamada."
      />
      <AppText variant="caption" color={colors.textSecondary}>
        {`${motivo.length}/${MOTIVO_MAXIMO}`}
      </AppText>
      {erro !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityRole="alert">
          {erro}
        </AppText>
      ) : null}
      <View style={styles.acoes}>
        <Button title="Voltar" variant="secondary" onPress={onClose} disabled={salvando} style={styles.metade} />
        <Button
          title="Salvar retificação"
          onPress={() => onSalvar(motivo.trim())}
          loading={salvando}
          disabled={!valido || total === 0}
          style={styles.metade}
        />
      </View>
    </BottomSheet>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    overline: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1, color: colors.textSecondary },
    mudanca: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
    },
    nome: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
    estado: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
    acoes: { flexDirection: 'row', gap: 12, marginTop: 4 },
    metade: { flex: 1 },
  });
}
