import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Selo } from '@/components/Selo';
import { useTheme } from '@/theme/ThemeProvider';

const TAMANHO_DO_ICONE = 20;

interface ProfessorDaChamadaRowProps {
  teacherId: string;
  nome: string;
  /** Cor do professor (§ 4); nula não acontece na equipe da aula. */
  cor: string | null;
  /** "Escalado · fazendo a chamada", "Acrescentado na chamada"… */
  legenda: string;
  presente: boolean | null;
  editado: boolean;
  editavel: boolean;
  onMarcar: (teacherId: string, presente: boolean) => void;
}

/**
 * Um professor na chamada (D27): quem faz a chamada confirma a presença dos
 * outros. Depois da conclusão, só o admin corrige (D28).
 */
function ProfessorDaChamadaRowComponent({
  teacherId,
  nome,
  cor,
  legenda,
  presente,
  editado,
  editavel,
  onMarcar,
}: ProfessorDaChamadaRowProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={styles.linha}>
      <View style={[styles.ponto, { backgroundColor: cor ?? colors.border }]} />
      <View style={styles.info}>
        <Text style={styles.nome} numberOfLines={1}>
          {nome}
        </Text>
        <Text style={styles.legenda}>{legenda}</Text>
        {editado ? (
          <View style={styles.selos}>
            <Selo texto="Editada" tom="aviso" />
          </View>
        ) : null}
      </View>
      <View style={styles.simbolos}>
        <Pressable
          onPress={() => onMarcar(teacherId, true)}
          disabled={!editavel}
          style={[styles.simbolo, presente === true ? { backgroundColor: colors.success, borderColor: colors.success } : null]}
          accessibilityRole="button"
          accessibilityState={{ selected: presente === true, disabled: !editavel }}
          accessibilityLabel={`Deu a aula: ${nome}`}
        >
          <Ionicons name="checkmark" size={TAMANHO_DO_ICONE} color={presente === true ? colors.onPrimary : colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => onMarcar(teacherId, false)}
          disabled={!editavel}
          style={[styles.simbolo, presente === false ? { backgroundColor: colors.error, borderColor: colors.error } : null]}
          accessibilityRole="button"
          accessibilityState={{ selected: presente === false, disabled: !editavel }}
          accessibilityLabel={`Não deu a aula: ${nome}`}
        >
          <Ionicons name="close" size={TAMANHO_DO_ICONE} color={presente === false ? colors.onPrimary : colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    ponto: { width: 10, height: 10, borderRadius: 5 },
    info: { flex: 1, gap: 2 },
    nome: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    legenda: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    selos: { flexDirection: 'row', gap: 6 },
    simbolos: { flexDirection: 'row', gap: 10 },
    simbolo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export const ProfessorDaChamadaRow = React.memo(ProfessorDaChamadaRowComponent);
