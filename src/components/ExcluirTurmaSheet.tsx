import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import type { Fonts } from '@/constants/theme';
import { createLogger } from '@/lib/logger';
import {
  previewGroupRemoval,
  removeGroup,
  type GroupRemovalPreview,
  type GroupRemovalResult,
  type GroupRow,
} from '@/services/groups.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';

const log = createLogger('ExcluirTurmaSheet');

/** Destino escolhido para os alunos; `null` enquanto ninguém escolheu. */
type Destino = { tipo: 'turma'; id: string } | { tipo: 'sem-turma' } | null;

interface ExcluirTurmaSheetProps {
  /** Turma a excluir; `null` mantém a folha fechada. */
  turma: GroupRow | null;
  /** Turmas ativas que podem receber os alunos (sem a própria). */
  destinos: GroupRow[];
  onClose: () => void;
  /** Chamado depois que o banco confirmou a exclusão. */
  onExcluida: (resultado: GroupRemovalResult) => void;
}

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`;
}

/**
 * Exclusão de turma com as consequências à vista.
 *
 * Antes de qualquer botão, a prévia do banco diz se a turma será APAGADA
 * (nunca usada) ou ARQUIVADA (tem histórico) e o que sai da agenda. Com
 * alunos, o destino é obrigatório: "Sem turma" só marcado de propósito. [#98]
 */
export function ExcluirTurmaSheet({ turma, destinos, onClose, onExcluida }: ExcluirTurmaSheetProps): React.JSX.Element {
  const { colors, fonts, minHitSlop } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts, minHitSlop), [colors, fonts, minHitSlop]);
  const [previa, setPrevia] = useState<GroupRemovalPreview | null>(null);
  const [erroDaPrevia, setErroDaPrevia] = useState<string | null>(null);
  const [destino, setDestino] = useState<Destino>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const turmaId = turma?.id ?? null;

  const carregarPrevia = useCallback(async () => {
    if (turmaId === null) return;
    setPrevia(null);
    setErroDaPrevia(null);
    try {
      setPrevia(await previewGroupRemoval(turmaId));
    } catch (falha) {
      log.error('Falha ao carregar a prévia da exclusão', falha);
      setErroDaPrevia(describeError(falha));
    }
  }, [turmaId]);

  useEffect(() => {
    setDestino(null);
    setErro(null);
    void carregarPrevia();
  }, [carregarPrevia]);

  const fechar = useCallback(() => {
    if (enviando) return;
    onClose();
  }, [enviando, onClose]);

  const temAlunos = previa !== null && previa.students > 0;
  const liberado = previa !== null && !enviando && (!temAlunos || destino !== null);

  const confirmar = useCallback(async () => {
    if (turmaId === null || !liberado) return;
    setEnviando(true);
    setErro(null);
    try {
      const resultado = await removeGroup({
        groupId: turmaId,
        destinationGroupId: destino?.tipo === 'turma' ? destino.id : null,
        leaveWithoutGroup: destino?.tipo === 'sem-turma',
      });
      onExcluida(resultado);
    } catch (falha) {
      log.error('Falha ao excluir a turma', falha);
      setErro(describeError(falha));
    } finally {
      setEnviando(false);
    }
  }, [turmaId, liberado, destino, onExcluida]);

  const consequencias = useMemo(() => {
    if (previa === null) return [];
    const itens: string[] = [];
    if (previa.futureClassesWithoutRollCall > 0) {
      itens.push(
        `${plural(previa.futureClassesWithoutRollCall, 'aula futura sem chamada sai', 'aulas futuras sem chamada saem')} da agenda, com as declarações e justificativas delas`,
      );
    }
    if (previa.activeSchedules > 0) {
      itens.push(`${plural(previa.activeSchedules, 'horário da grade é encerrado', 'horários da grade são encerrados')} hoje`);
    }
    if (previa.pastClasses > 0) {
      itens.push(`${plural(previa.pastClasses, 'aula passada fica', 'aulas passadas ficam')} no histórico, com a chamada`);
    }
    if (previa.frozenMonths > 0) {
      itens.push(`${plural(previa.frozenMonths, 'mês de frequência fechada fica guardado', 'meses de frequência fechada ficam guardados')}`);
    }
    return itens;
  }, [previa]);

  const titulo = previa?.canDeleteForGood === false ? 'Arquivar turma' : 'Excluir turma';

  return (
    <BottomSheet visible={turma !== null} onClose={fechar}>
      <AppText variant="subtitle">{turma !== null ? `${titulo} "${turma.name}"?` : titulo}</AppText>

      {erroDaPrevia !== null ? (
        <View style={styles.bloco}>
          <AppText variant="body" color={colors.error}>
            {erroDaPrevia}
          </AppText>
          <Button title="Tentar de novo" variant="secondary" onPress={() => void carregarPrevia()} />
        </View>
      ) : previa === null ? (
        <View style={styles.carregando}>
          <ActivityIndicator color={colors.primary} accessibilityLabel="Conferindo o que a exclusão afeta" />
        </View>
      ) : (
        <>
          <AppText variant="body" color={colors.textSecondary}>
            {previa.canDeleteForGood
              ? 'A turma não tem aula dada nem frequência fechada: ela será apagada de vez.'
              : 'A turma tem histórico, então será arquivada: some dos seletores e guarda aulas passadas, chamadas e frequências com o nome dela. Dá para reativar depois.'}
          </AppText>

          {consequencias.map((texto) => (
            <View key={texto} style={styles.item}>
              <Ionicons name="ellipse" size={6} color={colors.textSecondary} style={styles.marcador} />
              <Text style={styles.itemTexto}>{texto}</Text>
            </View>
          ))}

          {temAlunos ? (
            <View style={styles.bloco} accessibilityRole="radiogroup">
              <Text style={styles.rotulo}>
                PARA ONDE VÃO {previa.students === 1 ? 'O ALUNO' : `OS ${previa.students} ALUNOS`}?
              </Text>
              {destinos.map((opcao) => (
                <OpcaoDeDestino
                  key={opcao.id}
                  rotulo={opcao.name}
                  selecionada={destino?.tipo === 'turma' && destino.id === opcao.id}
                  onPress={() => setDestino({ tipo: 'turma', id: opcao.id })}
                  styles={styles}
                  colors={colors}
                />
              ))}
              <OpcaoDeDestino
                rotulo="Sem turma"
                selecionada={destino?.tipo === 'sem-turma'}
                onPress={() => setDestino({ tipo: 'sem-turma' })}
                styles={styles}
                colors={colors}
              />
              {destino?.tipo === 'sem-turma' ? (
                <AppText variant="caption" color={colors.warning}>
                  Sem turma, o aluno só vê eventos e fica com 100% de frequência até entrar numa turma.
                </AppText>
              ) : null}
              <AppText variant="caption" color={colors.textSecondary}>
                Trocar de turma no meio do mês reinicia a frequência do mês: a conta passa a valer da entrada na
                turma nova, e as aulas da turma antiga saem do mês. Se puder, faça isso na virada do mês.
              </AppText>
            </View>
          ) : null}
        </>
      )}

      {erro !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityLiveRegion="polite">
          {erro}
        </AppText>
      ) : null}

      <Button
        title={titulo}
        variant="danger"
        onPress={() => void confirmar()}
        disabled={!liberado}
        loading={enviando}
        accessibilityHint={temAlunos && destino === null ? 'Escolha antes para onde vão os alunos' : undefined}
      />
      <Button title="Cancelar" variant="secondary" onPress={fechar} disabled={enviando} />
    </BottomSheet>
  );
}

interface OpcaoDeDestinoProps {
  rotulo: string;
  selecionada: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorScheme;
}

function OpcaoDeDestino({ rotulo, selecionada, onPress, styles, colors }: OpcaoDeDestinoProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={styles.opcao}
      accessibilityRole="radio"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: selecionada }}
    >
      <Ionicons
        name={selecionada ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selecionada ? colors.primaryText : colors.textSecondary}
      />
      <Text style={styles.opcaoTexto}>{rotulo}</Text>
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts, minHitSlop: number) {
  return StyleSheet.create({
    carregando: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    bloco: {
      gap: 8,
      marginTop: 4,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    marcador: {
      marginTop: 7,
    },
    itemTexto: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textPrimary,
    },
    rotulo: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginTop: 8,
    },
    opcao: {
      minHeight: minHitSlop,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    opcaoTexto: {
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.textPrimary,
    },
  });
}
