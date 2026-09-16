import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ProfessorMultiPicker } from '@/components/ProfessorMultiPicker';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { WeekdayPicker } from '@/components/WeekdayPicker';
import { createLogger } from '@/lib/logger';
import type { DadosStackScreenProps } from '@/navigation/types';
import { saveSchedule } from '@/services/schedules.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDate } from '@/utils/datetime';
import { describeError } from '@/utils/errors';
import { resumoDoSalvamento, validarHorario, type HorarioValidado } from '@/utils/gradeSemanal';
import { dateIsoToBr, maskDate, maskTime } from '@/utils/masks';

const log = createLogger('HorarioFormScreen');

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Criar ou editar um horário da grade semanal (somente admin).
 *
 * Na edição, o dia da semana fica travado (para mudar, encerra e cria outro)
 * e há uma confirmação antes de salvar, porque as aulas futuras sem chamada
 * mudam junto. Depois de salvar, a pessoa vê o que mudou na agenda.
 */
export function HorarioFormScreen({ navigation, route }: DadosStackScreenProps<'HorarioForm'>): React.JSX.Element {
  const { groupId, groupName, schedule } = route.params;
  const { colors, spacing } = useTheme();
  const styles = useMemo(() => makeStyles(spacing.xxl), [spacing.xxl]);
  const editando = schedule !== undefined;

  const [titulo, setTitulo] = useState(schedule?.title ?? '');
  const [weekday, setWeekday] = useState<number | null>(schedule?.weekday ?? null);
  const [hora, setHora] = useState(schedule?.startTime ?? '');
  const [inicio, setInicio] = useState(
    schedule !== undefined ? dateIsoToBr(schedule.validFrom) : formatFullDate(new Date().toISOString()),
  );
  const [fim, setFim] = useState(schedule?.validUntil != null ? dateIsoToBr(schedule.validUntil) : '');
  const [professores, setProfessores] = useState<string[]>(schedule?.teacherIds ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const gravar = useCallback(
    async (horario: HorarioValidado) => {
      setSalvando(true);
      setErro(null);
      try {
        const resultado = await saveSchedule({
          id: schedule?.id ?? null,
          groupId,
          title: horario.titulo,
          weekday: horario.weekday,
          startTime: horario.hora,
          validFromIso: horario.inicioIso,
          validUntilIso: horario.fimIso,
          teacherIds: professores,
        });
        Alert.alert(editando ? 'Horário atualizado' : 'Horário criado', resumoDoSalvamento(resultado, editando), [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } catch (falha) {
        log.error('Falha ao salvar o horário', falha);
        setErro(describeError(falha));
      } finally {
        setSalvando(false);
      }
    },
    [schedule, groupId, professores, editando, navigation],
  );

  const salvar = useCallback(() => {
    const validacao = validarHorario({ titulo, weekday, hora, inicioBr: inicio, fimBr: fim });
    if (!validacao.ok) {
      setErro(validacao.mensagem);
      return;
    }
    if (!editando) {
      void gravar(validacao.horario);
      return;
    }
    Alert.alert(
      'Atualizar as próximas aulas?',
      'As aulas futuras deste horário que ainda não tiveram chamada serão atualizadas. Aulas com chamada e aulas editadas à mão ficam como estão.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salvar', onPress: () => void gravar(validacao.horario) },
      ],
    );
  }, [titulo, weekday, hora, inicio, fim, editando, gravar]);

  return (
    <ScreenWrapper edges={SCREEN_EDGES} avoidKeyboard>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppText variant="caption" color={colors.textSecondary} style={styles.turma}>
          Turma: {groupName}
        </AppText>

        <Input
          label="Título da aula"
          placeholder={`Ex.: Muay Thai — ${groupName}`}
          value={titulo}
          onChangeText={setTitulo}
          maxLength={80}
        />

        <AppText variant="label" style={styles.label}>
          Dia da semana
        </AppText>
        <WeekdayPicker value={weekday} onChange={setWeekday} disabled={editando} />
        {editando ? (
          <AppText variant="caption" color={colors.textSecondary} style={styles.hint}>
            Para mudar o dia, encerre este horário e crie outro.
          </AppText>
        ) : null}

        <Input
          label="Hora de início"
          placeholder="HH:MM"
          keyboardType="number-pad"
          value={hora}
          onChangeText={(valor) => setHora(maskTime(valor))}
          containerStyle={styles.spaced}
          accessibilityHint="Horário de Brasília"
        />
        <Input
          label="Início da vigência"
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          value={inicio}
          onChangeText={(valor) => setInicio(maskDate(valor))}
        />
        <Input
          label="Fim da vigência (opcional)"
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          value={fim}
          onChangeText={(valor) => setFim(maskDate(valor))}
        />

        <ProfessorMultiPicker label="Professores" value={professores} onChange={setProfessores} />

        {erro !== null ? (
          <AppText variant="caption" color={colors.error} style={styles.spaced} accessibilityLiveRegion="polite">
            {erro}
          </AppText>
        ) : null}

        <Button
          title={editando ? 'Salvar alterações' : 'Criar horário'}
          onPress={salvar}
          loading={salvando}
          style={styles.submit}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

function makeStyles(bottomPadding: number) {
  return StyleSheet.create({
    content: {
      paddingTop: 16,
      paddingBottom: bottomPadding,
    },
    turma: {
      marginBottom: 12,
    },
    label: {
      marginBottom: 8,
    },
    hint: {
      marginTop: 6,
    },
    spaced: {
      marginTop: 16,
    },
    submit: {
      marginTop: 24,
    },
  });
}
