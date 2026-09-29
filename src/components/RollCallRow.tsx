import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Selo } from '@/components/Selo';
import type { AttendanceStatus } from '@/services/classes.service';
import { useTheme } from '@/theme/ThemeProvider';
import type { SeloDaAula } from '@/utils/aulasDoAluno';
import { temMarcacao, type LinhaDaChamada } from '@/utils/chamada';
import type { Marcacao } from '@/utils/rollCall';

const TAMANHO_DO_ICONE = 20;

interface RollCallRowProps {
  linha: LinhaDaChamada;
  /** O que está marcado NA TELA (ainda não gravado até salvar). */
  marcacao: Marcacao;
  selo: SeloDaAula | null;
  detalhes: readonly string[];
  /** Selo "Editada" (D20: o professor vê só a marca). */
  editada: boolean;
  /** Falso para quem só visualiza, antes de a aula começar e no conflito do rascunho. */
  editavel: boolean;
  onMarcar: (userId: string, status: AttendanceStatus) => void;
  /** A ficha do aluno (§ 12, D32). */
  onAbrirFicha: (userId: string, nome: string) => void;
  /** Só para incluídos: tira da chamada. */
  onRetirar?: (userId: string) => void;
}

/**
 * Um aluno na chamada (mockups das linhas C e G): nome, selos, detalhes e os
 * dois símbolos. O marcado fica preenchido (verde presença, vermelho falta);
 * sem marcação, os dois ficam cinza. Quem trocou esta aula por outra só
 * aparece para constar, sem símbolos.
 *
 * Memoizado: marcar um aluno re-renderiza só a linha dele. [#68]
 */
function RollCallRowComponent({
  linha,
  marcacao,
  selo,
  detalhes,
  editada,
  editavel,
  onMarcar,
  onAbrirFicha,
  onRetirar,
}: RollCallRowProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const presente = marcacao === 'present';
  const ausente = marcacao === 'absent';

  return (
    <View style={styles.linha}>
      <View style={styles.info}>
        <Pressable
          onPress={() => onAbrirFicha(linha.userId, linha.nome)}
          style={styles.nome}
          accessibilityRole="button"
          accessibilityLabel={`Ficha de ${linha.nome}`}
          accessibilityHint="Abre a ficha do aluno, com a frequência e o histórico"
        >
          <Text style={styles.nomeTexto} numberOfLines={1}>
            {linha.nome}
          </Text>
          {selo !== null || editada ? (
            <View style={styles.selos}>
              {selo !== null ? <Selo texto={selo.texto} tom={selo.tom} /> : null}
              {editada ? <Selo texto="Editada" tom="aviso" /> : null}
            </View>
          ) : null}
          {detalhes.map((detalhe) => (
            <Text key={detalhe} style={styles.detalhe}>
              {detalhe}
            </Text>
          ))}
        </Pressable>
        {onRetirar !== undefined && editavel ? (
          <Pressable
            onPress={() => onRetirar(linha.userId)}
            style={styles.retirar}
            accessibilityRole="button"
            accessibilityLabel={`Retirar ${linha.nome} da chamada`}
          >
            <Text style={styles.retirarTexto}>Retirar da chamada</Text>
          </Pressable>
        ) : null}
      </View>

      {temMarcacao(linha.origem) ? (
        <View style={styles.simbolos}>
          <Pressable
            onPress={() => onMarcar(linha.userId, 'present')}
            disabled={!editavel}
            style={[styles.simbolo, presente ? { backgroundColor: colors.success, borderColor: colors.success } : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: presente, disabled: !editavel }}
            accessibilityLabel={`Presente: ${linha.nome}`}
          >
            <Ionicons name="checkmark" size={TAMANHO_DO_ICONE} color={presente ? colors.onPrimary : colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => onMarcar(linha.userId, 'absent')}
            disabled={!editavel}
            style={[styles.simbolo, ausente ? { backgroundColor: colors.error, borderColor: colors.error } : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: ausente, disabled: !editavel }}
            accessibilityLabel={`Falta: ${linha.nome}`}
          >
            <Ionicons name="close" size={TAMANHO_DO_ICONE} color={ausente ? colors.onPrimary : colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}
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
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    info: { flex: 1, gap: 2 },
    nome: { minHeight: 44, justifyContent: 'center', gap: 3 },
    nomeTexto: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.textPrimary },
    selos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    detalhe: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
    retirar: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    retirarTexto: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.error },
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
