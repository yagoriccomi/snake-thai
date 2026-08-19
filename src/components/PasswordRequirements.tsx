import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { checkPasswordRequirements } from '@/utils/validation';

interface PasswordRequirementsProps {
  /** Senha atualmente digitada. */
  password: string;
}

/**
 * Lista viva dos requisitos da política de senha.
 *
 * Em vez de recusar a senha no envio com uma mensagem genérica, mostra ao
 * usuário — enquanto ele digita — exatamente quais regras já foram cumpridas e
 * quais faltam. Cada item combina ícone e texto (a cor nunca é o único meio de
 * transmitir o estado) e o bloco inteiro é anunciado como região viva para
 * leitores de tela.
 */
function PasswordRequirementsComponent({
  password,
}: PasswordRequirementsProps): React.JSX.Element {
  const { colors, spacing } = useTheme();
  const requirements = useMemo(
    () => checkPasswordRequirements(password),
    [password],
  );
  const missingCount = requirements.filter((rule) => !rule.met).length;

  return (
    <View
      style={[styles.container, { marginBottom: spacing.md }]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        missingCount === 0
          ? 'Senha cumpre todos os requisitos de segurança.'
          : `Faltam ${missingCount} requisitos de segurança na senha.`
      }
    >
      {requirements.map((rule) => (
        <View key={rule.id} style={styles.row}>
          <Ionicons
            name={rule.met ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={rule.met ? colors.success : colors.textSecondary}
          />
          <AppText
            variant="caption"
            color={rule.met ? colors.success : colors.textSecondary}
          >
            {rule.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export const PasswordRequirements = React.memo(PasswordRequirementsComponent);
