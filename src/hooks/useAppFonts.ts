import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';

/** Resultado do carregamento das fontes da aplicação. */
interface AppFontsState {
  /** True quando todas as fontes terminaram de carregar. */
  fontsLoaded: boolean;
  /** Erro de carregamento, se houver. */
  fontError: Error | null;
}

/**
 * Carrega nativamente as fontes da marca (Inter para corpo, Syne para títulos).
 * As chaves aqui DEVEM bater com os nomes usados em `@/constants/theme` (fonts).
 *
 * @returns Estado de carregamento das fontes.
 */
export function useAppFonts(): AppFontsState {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Syne_700Bold,
    Syne_800ExtraBold,
  });

  return { fontsLoaded, fontError };
}
