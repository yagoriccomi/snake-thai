import React, { useEffect, useMemo } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Portal } from '@/components/Portal';
import { useTheme } from '@/theme/ThemeProvider';

const SHEET_EDGES: readonly Edge[] = ['bottom'];

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Folha inferior do design system. **Use esta, e não `Modal`, sempre que houver
 * campo de texto** — ver o porquê em `Portal.tsx`.
 *
 * Com o teclado aberto, a folha sobe junto (o `KeyboardAvoidingView` recebe o
 * evento, porque está na janela principal) e o conteúdo rola se não couber:
 * nenhum campo fica escondido atrás do teclado.
 *
 * O botão voltar do Android fecha a folha, como faria um Modal.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
}: BottomSheetProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <Portal>
      <KeyboardAvoidingView behavior="padding" style={StyleSheet.absoluteFill}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />
        <SafeAreaView edges={SHEET_EDGES} style={styles.sheet} accessibilityViewIsModal>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Portal>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    backdrop: { flexGrow: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    // Encolhe antes do fundo escurecido sumir: com teclado e pouco espaço, é
    // o conteúdo que rola, não a folha que sai da tela.
    sheet: {
      flexShrink: 1,
      maxHeight: '90%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    scroll: { flexGrow: 0 },
    content: { padding: 20, gap: 10 },
  });
}
