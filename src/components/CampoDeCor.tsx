import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Input } from '@/components/Input';
import { useTheme } from '@/theme/ThemeProvider';
import { COR_SUGERIDA, ehCorValida } from '@/utils/cor';

interface CampoDeCorProps {
  label: string;
  value: string;
  onChangeText: (valor: string) => void;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Campo da cor da pessoa (`#RRGGBB`) com a bolinha de prévia ao lado.
 *
 * A prévia só pinta quando o texto já é uma cor válida: pintar a meio caminho
 * ("#3F") mostraria uma cor que não é a que vai para o banco. É a única cor
 * que não vem de token de tema, porque é a própria escolha da pessoa. [#3][#6]
 */
export function CampoDeCor({
  label,
  value,
  onChangeText,
  error,
  containerStyle,
}: CampoDeCorProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.linha, containerStyle]}>
      <View
        testID="previa-da-cor"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[styles.previa, ehCorValida(value) ? { backgroundColor: value } : null]}
      />
      <Input
        label={label}
        placeholder={COR_SUGERIDA}
        autoCapitalize="characters"
        autoCorrect={false}
        value={value}
        onChangeText={onChangeText}
        error={error}
        containerStyle={styles.campo}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    linha: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    previa: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    campo: {
      flex: 1,
    },
  });
}
