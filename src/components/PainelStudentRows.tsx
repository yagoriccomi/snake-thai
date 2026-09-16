import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Fonts } from '@/constants/theme';
import type { AlunoEmRisco, Devedor } from '@/services/painel.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCents } from '@/utils/currency';
import { formatarPercentual } from '@/utils/frequency';
import { contagem } from '@/utils/painel';
import { rotuloDeAtraso } from '@/utils/payments';

/** Altura fixa da linha de devedor: permite `getItemLayout` na lista. */
export const ALTURA_DA_LINHA_DE_DEVEDOR = 76;

interface DelinquentStudentRowProps {
  devedor: Devedor;
  onPress: (devedor: Devedor) => void;
}

/** Um devedor do relatório: quem, quanto e há quanto tempo. */
function DelinquentStudentRowComponent({ devedor, onPress }: DelinquentStudentRowProps): React.JSX.Element {
  const { colors, fonts, minHitSlop } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts, minHitSlop), [colors, fonts, minHitSlop]);
  const abrir = useCallback(() => onPress(devedor), [onPress, devedor]);

  const detalhe = `${contagem(devedor.mensalidades, 'mensalidade', 'mensalidades')} · ${rotuloDeAtraso(devedor.maiorAtrasoDias)}`;
  const turma = devedor.turma ?? 'Sem turma';

  return (
    <Pressable
      onPress={abrir}
      style={({ pressed }) => [styles.linha, styles.linhaDeDevedor, pressed ? styles.pressionada : null]}
      accessibilityRole="button"
      accessibilityLabel={`${devedor.nome}, ${turma}${devedor.alunoAtivo ? '' : ', inativo'}: deve ${formatCents(devedor.totalDevidoCents)}, ${detalhe}`}
      accessibilityHint="Abre o histórico de pagamentos do aluno"
    >
      <View style={styles.texto}>
        <View style={styles.nomeLinha}>
          <Text style={styles.nome} numberOfLines={1}>
            {devedor.nome}
          </Text>
          {devedor.alunoAtivo ? null : (
            <View style={styles.selo}>
              <Text style={styles.seloTexto}>Inativo</Text>
            </View>
          )}
        </View>
        <Text style={styles.detalhe} numberOfLines={1}>
          {turma} · {detalhe}
        </Text>
      </View>
      <Text style={styles.valorDevido}>{formatCents(devedor.totalDevidoCents)}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export const DelinquentStudentRow = React.memo(DelinquentStudentRowComponent);

interface AtRiskStudentRowProps {
  aluno: AlunoEmRisco;
  onPress: (aluno: AlunoEmRisco) => void;
}

function percentualOuTraco(valor: number | null): string {
  return valor === null ? '—' : formatarPercentual(valor);
}

/** Aluno em risco de evasão: frequência do mês atual e do último mês fechado. */
function AtRiskStudentRowComponent({ aluno, onPress }: AtRiskStudentRowProps): React.JSX.Element {
  const { colors, fonts, minHitSlop } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts, minHitSlop), [colors, fonts, minHitSlop]);
  const abrir = useCallback(() => onPress(aluno), [onPress, aluno]);

  const atual = percentualOuTraco(aluno.frequenciaMesAtual);
  const anterior = percentualOuTraco(aluno.frequenciaUltimoMes);
  const turma = aluno.turma ?? 'Sem turma';

  return (
    <Pressable
      onPress={abrir}
      style={({ pressed }) => [styles.linha, pressed ? styles.pressionada : null]}
      accessibilityRole="button"
      accessibilityLabel={`${aluno.nome}, ${turma}: frequência ${aluno.frequenciaMesAtual === null ? 'sem aulas suficientes' : atual} neste mês e ${aluno.frequenciaUltimoMes === null ? 'sem registro' : anterior} no mês passado`}
      accessibilityHint="Abre a frequência do aluno"
    >
      <View style={styles.texto}>
        <Text style={styles.nome} numberOfLines={1}>
          {aluno.nome}
        </Text>
        <Text style={styles.detalhe} numberOfLines={1}>
          {turma} · Este mês {atual} · Mês passado {anterior}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export const AtRiskStudentRow = React.memo(AtRiskStudentRowComponent);

function makeStyles(colors: ColorScheme, fonts: Fonts, minHitSlop: number) {
  return StyleSheet.create({
    linha: {
      minHeight: Math.max(minHitSlop, 56),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    linhaDeDevedor: {
      height: ALTURA_DA_LINHA_DE_DEVEDOR,
    },
    pressionada: {
      backgroundColor: colors.surfaceElevated,
    },
    texto: {
      flex: 1,
      gap: 2,
    },
    nomeLinha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    nome: {
      flexShrink: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    selo: {
      borderWidth: 1,
      borderColor: colors.textSecondary,
      borderRadius: 6,
      paddingHorizontal: 6,
    },
    seloTexto: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      color: colors.textSecondary,
    },
    detalhe: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.textSecondary,
    },
    valorDevido: {
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      color: colors.error,
    },
  });
}
