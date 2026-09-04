import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { GroupPicker } from '@/components/GroupPicker';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import {
  SegmentedControl,
  type SegmentOption,
} from '@/components/SegmentedControl';
import { useAuth } from '@/context/AuthProvider';
import type { AulasStackScreenProps } from '@/navigation/types';
import {
  createClass,
  createClassAsProfessor,
  updateClass,
  type ClassType,
} from '@/services/classes.service';
import { useTheme } from '@/theme/ThemeProvider';
import { combineDateTimeToIso } from '@/utils/datetime';
import { maskDate, maskTime } from '@/utils/masks';

/** Quebra um ISO nas entradas do formulário (DD/MM/AAAA e HH:MM), em hora local. */
function isoToInputs(iso: string): { date: string; time: string } {
  const parsed = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return {
    date: `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

type CriarErrors = Partial<
  Record<'title' | 'dateTime' | 'group' | 'form', string>
>;

const TYPE_OPTIONS: ReadonlyArray<SegmentOption<ClassType>> = [
  { value: 'routine', label: 'Rotina' },
  { value: 'event', label: 'Evento' },
];

const SCREEN_EDGES = ['bottom'] as const;

/**
 * Formulário de criação/edição de aula:
 * - Rotina: título, data/hora e turma (group_id).
 * - Evento: título e data/hora, atribuído globalmente (todas as turmas).
 *
 * Edição é ação de admin. Criação: admin cria "solta" (sem professor); um
 * professor que cria já se vincula automaticamente como um dos professores
 * dela — "só podem criar aulas para seu usuário". [#55]
 */
export function CriarAulaScreen({
  navigation,
  route,
}: AulasStackScreenProps<'CriarAula'>): React.JSX.Element {
  const { colors, spacing } = useTheme();
  const { isProfessor, profile } = useAuth();
  const params = route.params;
  const editingId = params?.classId;
  const isEditing = editingId !== undefined;
  const initialDateTime =
    params !== undefined ? isoToInputs(params.dateTimeIso) : null;

  const [type, setType] = useState<ClassType>(params?.type ?? 'routine');
  const [title, setTitle] = useState(params?.title ?? '');
  const [date, setDate] = useState(initialDateTime?.date ?? '');
  const [time, setTime] = useState(initialDateTime?.time ?? '');
  const [groupId, setGroupId] = useState<string | null>(params?.groupId ?? null);
  const [errors, setErrors] = useState<CriarErrors>({});
  const [saving, setSaving] = useState(false);

  const isRoutine = type === 'routine';

  const handleDateChange = useCallback((value: string) => setDate(maskDate(value)), []);
  const handleTimeChange = useCallback((value: string) => setTime(maskTime(value)), []);

  const handleSubmit = useCallback(async () => {
    const next: CriarErrors = {};
    if (title.trim().length < 3) {
      next.title = 'Informe um título com pelo menos 3 caracteres.';
    }
    const dateTimeIso = combineDateTimeToIso(date, time);
    if (dateTimeIso === null) {
      next.dateTime = 'Data/hora inválida (use DD/MM/AAAA e HH:MM).';
    }
    if (isRoutine && groupId === null) {
      next.group = 'Selecione a turma da rotina.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || dateTimeIso === null) {
      return;
    }

    setSaving(true);
    try {
      const input = {
        title,
        type,
        dateTimeIso,
        groupId: isRoutine ? groupId : null,
      };
      if (editingId !== undefined) {
        await updateClass(editingId, input);
      } else if (isProfessor && profile !== null) {
        await createClassAsProfessor(input, profile.id);
      } else {
        await createClass(input);
      }
      navigation.goBack();
    } catch {
      setErrors({
        form: isEditing
          ? 'Não foi possível salvar a aula. Tente novamente.'
          : 'Não foi possível criar a aula. Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  }, [
    title,
    date,
    time,
    isRoutine,
    groupId,
    type,
    navigation,
    editingId,
    isEditing,
    isProfessor,
    profile,
  ]);

  const styles = useMemo(() => makeStyles(spacing.xxl), [spacing.xxl]);

  return (
    <ScreenWrapper edges={SCREEN_EDGES} avoidKeyboard>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="label" style={styles.label}>
          Tipo
        </AppText>
        <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />

        <Input
          label="Título"
          placeholder={isRoutine ? 'Ex.: Muay Thai — Turma A' : 'Ex.: Campeonato Interno'}
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          containerStyle={styles.spaced}
        />

        <Input
          label="Data"
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          value={date}
          onChangeText={handleDateChange}
          error={errors.dateTime}
        />
        <Input
          label="Hora"
          placeholder="HH:MM"
          keyboardType="number-pad"
          value={time}
          onChangeText={handleTimeChange}
        />

        {isRoutine ? (
          <>
            <GroupPicker label="Turma" value={groupId} onChange={setGroupId} />
            {errors.group !== undefined ? (
              <AppText variant="caption" color={colors.error}>
                {errors.group}
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText variant="caption" style={styles.hint}>
            Eventos são globais: ficam visíveis para todas as turmas.
          </AppText>
        )}

        {errors.form !== undefined ? (
          <AppText variant="caption" color={colors.error} style={styles.spaced}>
            {errors.form}
          </AppText>
        ) : null}

        <Button
          title={isEditing ? 'Salvar alterações' : 'Criar aula'}
          onPress={handleSubmit}
          loading={saving}
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
    label: {
      marginBottom: 8,
    },
    spaced: {
      marginTop: 16,
    },
    hint: {
      marginTop: 8,
    },
    submit: {
      marginTop: 24,
    },
  });
}
