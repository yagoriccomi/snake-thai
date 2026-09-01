import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import type { Fonts, Radius } from '@/constants/theme';
import { useGroups } from '@/hooks/useGroups';
import type { GroupRow } from '@/services/groups.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

interface GroupPickerProps {
  label?: string;
  /** group_id atualmente selecionado (ou null para "Sem turma"). */
  value: string | null;
  onChange: (groupId: string | null) => void;
}

/**
 * Seletor de turma (group_id): abre um modal com as turmas existentes, a opção
 * "Sem turma" e a criação inline de uma nova turma (admin).
 */
export function GroupPicker({ label, value, onChange }: GroupPickerProps): React.JSX.Element {
  const { colors, radius, fonts } = useTheme();
  const { groups, addGroup } = useGroups();
  const styles = useMemo(() => makeStyles(colors, radius, fonts), [colors, radius, fonts]);

  const [visible, setVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedName = useMemo(() => {
    if (value === null) {
      return 'Sem turma';
    }
    return groups.find((group) => group.id === value)?.name ?? 'Turma selecionada';
  }, [value, groups]);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => {
    setVisible(false);
    setError(null);
    setNewName('');
  }, []);

  const select = useCallback(
    (groupId: string | null) => {
      onChange(groupId);
      close();
    },
    [onChange, close],
  );

  const handleAdd = useCallback(async () => {
    if (newName.trim().length < 2) {
      setError('Informe um nome de turma válido.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const created = await addGroup(newName);
      select(created.id);
    } catch {
      setError('Não foi possível criar a turma.');
    } finally {
      setAdding(false);
    }
  }, [newName, addGroup, select]);

  const renderItem = useCallback<ListRenderItem<GroupRow>>(
    ({ item }) => (
      <Pressable
        style={styles.option}
        onPress={() => select(item.id)}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <AppText variant="body">{item.name}</AppText>
        {item.id === value ? (
          <Ionicons name="checkmark" size={18} color={colors.primaryText} />
        ) : null}
      </Pressable>
    ),
    [styles, select, value, colors.primary],
  );

  return (
    <View style={styles.container}>
      {label !== undefined ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={styles.field}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Turma: ${selectedName}`}
      >
        <Text style={styles.fieldText}>{selectedName}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <AppText variant="subtitle" style={styles.sheetTitle}>
            Selecionar turma
          </AppText>

          <Pressable
            style={styles.option}
            onPress={() => select(null)}
            accessibilityRole="button"
            accessibilityLabel="Sem turma"
          >
            <AppText variant="body">Sem turma</AppText>
            {value === null ? (
              <Ionicons name="checkmark" size={18} color={colors.primaryText} />
            ) : null}
          </Pressable>

          <FlatList
            data={groups}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
          />

          <View style={styles.addRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Nova turma"
              placeholderTextColor={colors.textSecondary}
              style={styles.addInput}
              accessibilityLabel="Nome da nova turma"
            />
            <Button title="Adicionar" onPress={handleAdd} loading={adding} />
          </View>
          {error !== null ? (
            <AppText variant="caption" color={colors.error}>
              {error}
            </AppText>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const keyExtractor = (item: GroupRow): string => item.id;

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
      backgroundColor: colors.inputBackground,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fieldText: {
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.textPrimary,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      maxHeight: '70%',
      gap: 8,
    },
    sheetTitle: {
      marginBottom: 8,
    },
    list: {
      maxHeight: 240,
    },
    option: {
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    addInput: {
      flex: 1,
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: 16,
    },
  });
}
