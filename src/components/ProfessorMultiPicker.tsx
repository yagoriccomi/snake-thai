import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import type { Fonts, Radius } from '@/constants/theme';
import { createLogger } from '@/lib/logger';
import { fetchAllProfessors } from '@/services/profile.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import type { Profile } from '@/types/models';

const log = createLogger('ProfessorMultiPicker');

interface ProfessorMultiPickerProps {
  label?: string;
  /** Ids dos professores escolhidos. */
  value: string[];
  onChange: (teacherIds: string[]) => void;
}

/** Só quem pode ser escalado: o banco recusa professor inativo ou excluído. */
function professoresAtivos(perfis: Profile[]): Profile[] {
  return perfis.filter((perfil) => perfil.status === 'active' && perfil.anonymized_at === null);
}

/**
 * Seleção de vários professores numa folha, com a cor de cada um — a mesma
 * da agenda. A lista é carregada ao montar para o campo já mostrar os nomes
 * na edição de um horário.
 */
export function ProfessorMultiPicker({ label, value, onChange }: ProfessorMultiPickerProps): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);
  const [professores, setProfessores] = useState<Profile[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [retirados, setRetirados] = useState(0);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setProfessores(professoresAtivos(await fetchAllProfessors()));
    } catch (falha) {
      log.error('Falha ao carregar professores', falha);
      setErro('Não foi possível carregar os professores. Verifique sua conexão.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Horário antigo pode ter professor que saiu: tira da seleção e AVISA, em
  // vez de deixar o salvamento ser recusado sem a pessoa entender o porquê.
  useEffect(() => {
    if (professores === null) return;
    const ativos = new Set(professores.map((professor) => professor.id));
    const validos = value.filter((id) => ativos.has(id));
    if (validos.length !== value.length) {
      setRetirados(value.length - validos.length);
      onChange(validos);
    }
  }, [professores, value, onChange]);

  const selecionados = useMemo(
    () => (professores ?? []).filter((professor) => value.includes(professor.id)),
    [professores, value],
  );

  const resumo = useMemo(() => {
    if (professores === null) return erro !== null ? 'Professores indisponíveis' : 'Carregando professores…';
    if (selecionados.length === 0) return 'Nenhum professor';
    return selecionados.map((professor) => professor.name ?? 'Professor').join(', ');
  }, [professores, erro, selecionados]);

  const alternar = useCallback(
    (id: string, marcado: boolean) => {
      onChange(marcado ? [...value, id] : value.filter((atual) => atual !== id));
    },
    [value, onChange],
  );

  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);

  return (
    <View style={styles.container}>
      {label !== undefined ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={styles.field}
        onPress={abrir}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Professores'}: ${resumo}`}
        accessibilityHint="Abre a lista de professores para marcar ou desmarcar"
      >
        <Text style={styles.fieldText} numberOfLines={2}>
          {resumo}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
      {retirados > 0 ? (
        <AppText variant="caption" color={colors.warning} style={styles.aviso}>
          {retirados === 1
            ? 'Um professor que não está mais ativo saiu da seleção.'
            : `${retirados} professores que não estão mais ativos saíram da seleção.`}
        </AppText>
      ) : null}

      <BottomSheet visible={aberto} onClose={fechar}>
        <AppText variant="subtitle">Professores do horário</AppText>
        {erro !== null ? (
          <View style={styles.estado}>
            <AppText variant="body" color={colors.error}>
              {erro}
            </AppText>
            <Button title="Tentar de novo" variant="secondary" onPress={() => void carregar()} />
          </View>
        ) : professores === null ? (
          <View style={styles.estado}>
            <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando professores" />
          </View>
        ) : professores.length === 0 ? (
          <AppText variant="body" color={colors.textSecondary}>
            Nenhum professor ativo. Cadastre em Dados › Cadastrar professor ou admin.
          </AppText>
        ) : (
          professores.map((professor) => (
            <Checkbox
              key={professor.id}
              checked={value.includes(professor.id)}
              onChange={(marcado) => alternar(professor.id, marcado)}
              accessibilityLabel={professor.name ?? 'Professor'}
            >
              <View style={styles.opcao}>
                <View style={[styles.bolinha, { backgroundColor: professor.color ?? colors.border }]} />
                <AppText variant="body">{professor.name ?? 'Professor'}</AppText>
              </View>
            </Checkbox>
          ))
        )}
        <Button title="Pronto" onPress={fechar} />
      </BottomSheet>
    </View>
  );
}

function makeStyles(colors: ColorScheme, radius: Radius, fonts: Fonts) {
  return StyleSheet.create({
    container: {
      width: '100%',
      marginBottom: 12,
    },
    label: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    field: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.inputBackground,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    fieldText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.textPrimary,
    },
    aviso: {
      marginTop: 4,
    },
    estado: {
      gap: 12,
      paddingVertical: 12,
    },
    opcao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bolinha: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
  });
}
