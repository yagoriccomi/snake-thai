/**
 * Design tokens da marca Snake Thai independentes de modo (claro/escuro).
 *
 * Espaçamento, raios, tipografia e alvo de toque ficam centralizados aqui para
 * eliminar "magic numbers" e garantir consistência. As CORES (que mudam entre
 * claro/escuro) vivem em `@/theme/colors`. Fonte: `Identidade-Visual.md`.
 */

/** Escala de espaçamento (dp). Base 4 para ritmo vertical consistente. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Raios de borda. Cantos levemente arredondados (8–12) por padrão. */
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  pill: 9999,
} as const;

/**
 * Nomes das famílias tipográficas carregadas via `@expo-google-fonts`.
 * Devem corresponder exatamente às chaves passadas ao `useFonts`
 * (ver `@/hooks/useAppFonts`): Inter para corpo, Syne para títulos.
 */
export const fonts = {
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  heading: 'Syne_700Bold',
  headingBold: 'Syne_800ExtraBold',
} as const;

/**
 * Área de toque mínima recomendada (dp) para elementos interativos,
 * conforme diretrizes de acessibilidade mobile (A11y).
 */
export const MIN_HIT_SLOP = 44;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Fonts = typeof fonts;
