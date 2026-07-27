import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';

/**
 * Componente raiz do aplicativo Snake Thai.
 *
 * Base mínima em Dark Mode (identidade visual da marca). Providers globais
 * (auth, tema, query client) e a navegação (React Navigation / Expo Router)
 * entram na fase de implementação — mantido simples aqui de propósito.
 *
 * @returns A árvore de UI raiz do app.
 */
export default function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text
        style={styles.title}
        accessibilityRole="header"
        accessibilityLabel="Snake Thai"
      >
        Snake Thai
      </Text>
      <Text style={styles.subtitle}>Ambiente configurado. Bora treinar. 🐍</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    color: colors.accentNeon,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
});
