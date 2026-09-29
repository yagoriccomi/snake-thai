import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Selo } from '@/components/Selo';
import { TeacherDot } from '@/components/TeacherDot';
import { TeacherRail } from '@/components/TeacherRail';
import type { AulaDoAluno } from '@/services/aulas.service';
import type { ClassTeacherRef } from '@/services/classes.service';
import { useTheme } from '@/theme/ThemeProvider';
import { acaoDaAula, detalheDaAula, seloDaAula } from '@/utils/aulasDoAluno';
import { formatTime } from '@/utils/datetime';

interface AulaDoAlunoRowProps {
  aula: AulaDoAluno;
  /** O menu mostra também o selo "Sua aula" (§ 12.2). */
  noMenu: boolean;
  ocupada: boolean;
  onVou: (aula: AulaDoAluno) => void;
  onNaoVou: (aula: AulaDoAluno) => void;
  onDesmarcar: (aula: AulaDoAluno) => void;
  /** "Eu estava na aula" (§ 9.3). */
  onEuEstava: (aula: AulaDoAluno) => void;
  /** "Trocar para esta" (§ 9.4): só o menu oferece. */
  onTrocar?: (aula: AulaDoAluno) => void;
  /** "Desistir da troca" (§ 9.4, T36). */
  onDesistir?: (aula: AulaDoAluno) => void;
}

function comoProfessores(aula: AulaDoAluno): ClassTeacherRef[] {
  return aula.teachers.map((professor) => ({ ...professor, joinedAt: '' }));
}

/**
 * Uma aula do aluno: hora, trilho de cor, título, selo, detalhe da troca e a
 * ação que a § 12.2 manda para aquela linha. Rótulos e botões saem só das
 * colunas do banco (`utils/aulasDoAluno`).
 */
export const AulaDoAlunoRow = React.memo(function AulaDoAlunoRow({
  aula,
  noMenu,
  ocupada,
  onVou,
  onNaoVou,
  onDesmarcar,
  onEuEstava,
  onTrocar,
  onDesistir,
}: AulaDoAlunoRowProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const acao = acaoDaAula(aula);
  const selo = seloDaAula(aula, noMenu);
  const detalhe = detalheDaAula(aula);
  const professores = useMemo(() => comoProfessores(aula), [aula]);
  const legenda = aula.type === 'event' ? 'Evento' : aula.group_name ?? (aula.audience === 'free' ? 'Livres' : null);

  return (
    <View style={styles.linha}>
      <Text style={[styles.hora, aula.cancelled ? styles.riscado : null]}>{formatTime(aula.date_time)}</Text>
      <TeacherRail teachers={professores} />
      <View style={styles.corpo}>
        <Text style={[styles.titulo, aula.cancelled ? styles.riscado : null]} numberOfLines={2}>
          {aula.title}
        </Text>
        <View style={styles.sub}>
          {selo !== null ? <Selo texto={selo.texto} tom={selo.tom} /> : null}
          {legenda !== null ? <Text style={styles.legenda}>{legenda}</Text> : null}
        </View>
        {detalhe !== null ? <Text style={styles.detalhe}>{detalhe}</Text> : null}
        <TeacherDot teachers={professores} />
        {onTrocar !== undefined && aula.can_swap_to && !ocupada ? (
          <Pressable
            onPress={() => onTrocar(aula)}
            hitSlop={8}
            style={styles.linkDaTroca}
            accessibilityRole="button"
            accessibilityLabel={`Trocar para esta: ${aula.title}`}
          >
            <Text style={styles.linkTexto}>Trocar para esta</Text>
          </Pressable>
        ) : null}
        {onDesistir !== undefined && aula.can_cancel_swap && !ocupada ? (
          <Pressable
            onPress={() => onDesistir(aula)}
            hitSlop={8}
            style={styles.linkDaTroca}
            accessibilityRole="button"
            accessibilityLabel={`Desistir da troca: ${aula.title}`}
          >
            <Text style={styles.linkTexto}>Desistir da troca</Text>
          </Pressable>
        ) : null}
      </View>

      {ocupada ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Salvando" />
      ) : acao === 'eu-estava' ? (
        <Pressable
          onPress={() => onEuEstava(aula)}
          style={styles.chip}
          accessibilityRole="button"
          accessibilityLabel={`Eu estava na aula: ${aula.title}`}
          accessibilityHint="Pede ao professor a presença nesta aula"
        >
          <Text style={styles.chipTexto}>Eu estava na aula</Text>
        </Pressable>
      ) : acao === 'vou' || acao === 'vou-extra' ? (
        <Pressable
          onPress={() => onVou(aula)}
          style={styles.chip}
          accessibilityRole="button"
          accessibilityLabel={acao === 'vou' ? `Vou: ${aula.title}` : `Vou (extra): ${aula.title}`}
        >
          <Text style={styles.chipTexto}>{acao === 'vou' ? 'Vou' : 'Vou (extra)'}</Text>
        </Pressable>
      ) : acao === 'desmarcar' || acao === 'desmarcar-extra' ? (
        <View style={styles.marcada}>
          <Pressable
            onPress={() => onDesmarcar(aula)}
            hitSlop={8}
            style={styles.link}
            accessibilityRole="button"
            accessibilityLabel={`Desmarcar: ${aula.title}`}
          >
            <Text style={styles.linkTexto}>Desmarcar</Text>
          </Pressable>
        </View>
      ) : acao === 'vou-nao-vou' ? (
        <View style={styles.presenca}>
          <Pressable
            onPress={() => onVou(aula)}
            style={[
              styles.marca,
              { borderColor: colors.success },
              aula.declared_status === 'present' ? { backgroundColor: colors.success } : null,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: aula.declared_status === 'present' }}
            accessibilityLabel="Vou"
          >
            <Ionicons name="checkmark" size={18} color={aula.declared_status === 'present' ? colors.onPrimary : colors.success} />
          </Pressable>
          <Pressable
            onPress={() => onNaoVou(aula)}
            style={[
              styles.marca,
              { borderColor: colors.error },
              aula.declared_status === 'absent' ? { backgroundColor: colors.error } : null,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: aula.declared_status === 'absent' }}
            accessibilityLabel="Não vou"
            accessibilityHint="Registra a falta e permite acrescentar uma justificativa"
          >
            <Ionicons name="close" size={18} color={aula.declared_status === 'absent' ? colors.onPrimary : colors.error} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) {
  return StyleSheet.create({
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    hora: {
      width: 48,
      textAlign: 'right',
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    riscado: {
      textDecorationLine: 'line-through',
      color: colors.textSecondary,
    },
    corpo: { flex: 1, gap: 4 },
    titulo: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    sub: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    legenda: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    detalhe: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.warning },
    chip: {
      minHeight: 44,
      minWidth: 48,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary },
    marcada: { alignItems: 'flex-end' },
    link: { minHeight: 44, justifyContent: 'center' },
    linkDaTroca: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
    linkTexto: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.primaryText },
    presenca: { flexDirection: 'row', gap: 8 },
    marca: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
