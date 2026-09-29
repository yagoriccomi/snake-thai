import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Selo } from '@/components/Selo';
import { TEXTO_MAXIMO } from '@/constants/solicitacoes';
import { createLogger } from '@/lib/logger';
import type { AulaDoAluno } from '@/services/aulas.service';
import type { TipoDeTroca } from '@/services/trocas.service';
import { useTheme } from '@/theme/ThemeProvider';
import { diaEHora } from '@/utils/aulasDoAluno';
import { describeError } from '@/utils/errors';
import { avisoDeFimDoHorario, ehReposicao, opcoesDeOrigem, ROTULO_DO_TIPO, TEXTOS_DA_TROCA } from '@/utils/trocas';

const log = createLogger('TrocarAulaSheet');

export const TROCA_PEDIDA = 'Pedido de troca enviado. A aula nova fica como Troca pendente até a decisão.';

const TIPOS = [
  { value: 'once', label: ROTULO_DO_TIPO.once },
  { value: 'permanent', label: ROTULO_DO_TIPO.permanent },
] as const;

interface TrocarAulaSheetProps {
  /** A aula nova ("Trocar para esta"). */
  nova: AulaDoAluno;
  /** As linhas da semana do menu: as originais possíveis saem daqui. */
  aulasDaSemana: readonly AulaDoAluno[];
  onClose: () => void;
  /** Deve lançar em caso de falha; a folha mostra a frase e continua aberta. */
  onPedir: (de: string, tipo: TipoDeTroca, texto: string | null) => Promise<void>;
}

/**
 * A folha **Trocar aula** (§ 9.4, § 3, mockups da linha G): qual aula dele
 * sai, o tipo e, na permanente, a justificativa obrigatória. Os anexos da
 * permanente entram depois do G2. As opções saem só das colunas do banco.
 */
export function TrocarAulaSheet({ nova, aulasDaSemana, onClose, onPedir }: TrocarAulaSheetProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [tipo, setTipo] = useState<TipoDeTroca>('once');
  const [origem, setOrigem] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pedida, setPedida] = useState(false);

  const opcoes = useMemo(() => opcoesDeOrigem(aulasDaSemana, nova, tipo), [aulasDaSemana, nova, tipo]);
  const permanente = tipo === 'permanent';
  const podePedir = origem !== null && opcoes.some((aula) => aula.class_id === origem) && (!permanente || texto.trim() !== '');

  const mudarTipo = (novoTipo: TipoDeTroca): void => {
    setTipo(novoTipo);
    setOrigem(null);
    setErro(null);
  };

  const pedir = async (): Promise<void> => {
    if (origem === null) return;
    setEnviando(true);
    setErro(null);
    try {
      await onPedir(origem, tipo, permanente ? texto : null);
      setPedida(true);
    } catch (falha) {
      log.warn('Troca não pedida', falha);
      setErro(describeError(falha));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <BottomSheet visible onClose={enviando ? () => undefined : onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        Trocar aula
      </AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {`Para: ${nova.title} · ${diaEHora(nova.date_time)}`}
      </AppText>

      {pedida ? (
        <>
          <AppText variant="body" accessibilityRole="alert">
            {TROCA_PEDIDA}
          </AppText>
          <Button title="Fechar" variant="secondary" onPress={onClose} />
        </>
      ) : (
        <>
          {/* Só aula da grade semanal pode ter troca permanente (§ 9.4). */}
          {nova.is_recurring ? <SegmentedControl options={TIPOS} value={tipo} onChange={mudarTipo} /> : null}

          <Text style={styles.pergunta}>{TEXTOS_DA_TROCA.pergunta}</Text>
          {opcoes.length === 0 ? (
            <AppText variant="caption" color={colors.textSecondary}>
              {TEXTOS_DA_TROCA.semOpcao}
            </AppText>
          ) : (
            <View style={styles.opcoes} accessibilityRole="radiogroup">
              {opcoes.map((aula) => {
                const escolhida = aula.class_id === origem;
                return (
                  <Pressable
                    key={aula.class_id}
                    onPress={() => setOrigem(aula.class_id)}
                    style={[styles.opcao, escolhida ? styles.escolhida : null]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: escolhida }}
                    accessibilityLabel={`${aula.title}, ${diaEHora(aula.date_time)}`}
                  >
                    <Text style={styles.opcaoTexto} numberOfLines={1}>
                      {`${aula.title} · ${diaEHora(aula.date_time)}`}
                    </Text>
                    {!permanente && ehReposicao(aula) ? <Selo texto="Reposição" tom="aviso" /> : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          {permanente ? (
            <>
              <Input
                label={`${TEXTOS_DA_TROCA.campoDaPermanente} (obrigatório)`}
                value={texto}
                onChangeText={setTexto}
                multiline
                maxLength={TEXTO_MAXIMO}
              />
              <AppText variant="caption" color={colors.textSecondary}>
                {TEXTOS_DA_TROCA.avisoDaPermanente}
              </AppText>
              {nova.schedule_ends_on !== null ? (
                <AppText variant="caption" color={colors.warning}>
                  {avisoDeFimDoHorario(nova.schedule_ends_on)}
                </AppText>
              ) : null}
            </>
          ) : null}

          {erro !== null ? (
            <AppText variant="caption" color={colors.error} accessibilityRole="alert">
              {erro}
            </AppText>
          ) : null}
          <View style={styles.acoes}>
            <Button title="Voltar" variant="secondary" onPress={onClose} disabled={enviando} style={styles.metade} />
            <Button
              title="Pedir troca"
              onPress={() => void pedir()}
              loading={enviando}
              disabled={!podePedir}
              style={styles.metade}
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    pergunta: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.textPrimary, marginTop: 4 },
    opcoes: { gap: 8 },
    opcao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    escolhida: { borderColor: colors.primaryText, borderWidth: 2 },
    opcaoTexto: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
    acoes: { flexDirection: 'row', gap: 12, marginTop: 4 },
    metade: { flex: 1 },
  });
}
