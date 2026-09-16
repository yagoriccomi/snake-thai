import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { JustificationReview } from '@/components/JustificationReview';
import type { AttendanceStatus, StudentRef } from '@/services/classes.service';
import type { MonthlyFrequency } from '@/services/frequency.service';
import type { JustificationRow, JustificationStatus } from '@/services/justifications.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatarPercentual } from '@/utils/frequency';
import type { Marcacao } from '@/utils/rollCall';

const TAMANHO_DO_ICONE = 20;

interface RollCallRowProps {
  student: StudentRef;
  /** O que está marcado NA TELA (ainda não gravado até concluir). */
  marcacao: Marcacao;
  declarado: AttendanceStatus | undefined;
  frequencia: MonthlyFrequency | undefined;
  justificativa: JustificationRow | undefined;
  /** Falso para quem só visualiza e antes de a aula começar. */
  editavel: boolean;
  podeRevisar: boolean;
  revisando: boolean;
  onMarcar: (userId: string, status: AttendanceStatus) => void;
  onAbrirHistorico: (student: StudentRef) => void;
  onRevisar: (justificationId: string, status: Exclude<JustificationStatus, 'pending'>) => void;
  onAbrirAnexo: (justificationId: string) => void;
}

/**
 * Um aluno na chamada: nome, frequência, declaração e os dois símbolos. O
 * marcado fica preenchido com a cor (verde presença, vermelho falta) e o outro
 * fica cinza; sem marcação, os dois ficam cinza.
 *
 * Memoizado: marcar um aluno re-renderiza só a linha dele, não a lista.
 */
function RollCallRowComponent({
  student,
  marcacao,
  declarado,
  frequencia,
  justificativa,
  editavel,
  podeRevisar,
  revisando,
  onMarcar,
  onAbrirHistorico,
  onRevisar,
  onAbrirAnexo,
}: RollCallRowProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const nome = student.name ?? 'Aluno pendente';
  const presente = marcacao === 'present';
  const ausente = marcacao === 'absent';

  return (
    <View style={styles.linha}>
      <View style={styles.info}>
        <Pressable
          onPress={() => onAbrirHistorico(student)}
          style={styles.nome}
          accessibilityRole="button"
          accessibilityLabel={`Frequência de ${nome}`}
          accessibilityHint="Abre o histórico mensal do aluno"
        >
          <AppText variant="body">{nome}</AppText>
          {frequencia !== undefined ? (
            <AppText variant="caption" color={colors.textSecondary}>
              Frequência {formatarPercentual(frequencia.frequencyPercent)} · {frequencia.attended}/
              {frequencia.totalClasses} no mês
            </AppText>
          ) : null}
          {declarado !== undefined ? (
            <AppText variant="caption" color={colors.textSecondary}>
              {declarado === 'present' ? 'Declarou que vem' : 'Declarou que não vem'}
            </AppText>
          ) : null}
        </Pressable>
        {justificativa !== undefined ? (
          <JustificationReview
            justification={justificativa}
            canReview={podeRevisar}
            busy={revisando}
            onReview={onRevisar}
            onOpenAttachment={onAbrirAnexo}
          />
        ) : null}
      </View>

      <View style={styles.simbolos}>
        <Pressable
          onPress={() => onMarcar(student.id, 'present')}
          disabled={!editavel}
          style={[
            styles.simbolo,
            presente ? { backgroundColor: colors.success, borderColor: colors.success } : null,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: presente, disabled: !editavel }}
          accessibilityLabel={`Presente: ${nome}`}
        >
          <Ionicons
            name="checkmark"
            size={TAMANHO_DO_ICONE}
            color={presente ? colors.onPrimary : colors.textSecondary}
          />
        </Pressable>
        <Pressable
          onPress={() => onMarcar(student.id, 'absent')}
          disabled={!editavel}
          style={[
            styles.simbolo,
            ausente ? { backgroundColor: colors.error, borderColor: colors.error } : null,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: ausente, disabled: !editavel }}
          accessibilityLabel={`Falta: ${nome}`}
        >
          <Ionicons
            name="close"
            size={TAMANHO_DO_ICONE}
            color={ausente ? colors.onPrimary : colors.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    info: { flex: 1 },
    nome: { minHeight: 44, justifyContent: 'center' },
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

export const RollCallRow = React.memo(RollCallRowComponent);
