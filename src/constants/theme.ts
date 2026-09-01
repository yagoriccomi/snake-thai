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

/**
 * Escala tipográfica.
 *
 * Antes cada tela escolhia o próprio tamanho de fonte, o que achatava a
 * hierarquia: título e legenda acabavam quase do mesmo tamanho e nada se
 * destacava. A escala abaixo tem saltos deliberados para o olho distinguir
 * nível de importância à distância [#3][#6].
 */
export const typography = {
  display: { size: 32, lineHeight: 38 },
  title: { size: 24, lineHeight: 30 },
  subtitle: { size: 17, lineHeight: 24 },
  body: { size: 15, lineHeight: 22 },
  caption: { size: 13, lineHeight: 18 },
  overline: { size: 11, lineHeight: 14 },
} as const;

/**
 * Profundidade das superfícies.
 *
 * Usada apenas no tema claro: no escuro, a borda sutil já separa o cartão do
 * fundo, e sombra forte vira mancha em vez de relevo.
 */
export const elevation = {
  flat: {
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;

/** Níveis de profundidade disponíveis para superfícies. */
export type ElevationLevel = keyof typeof elevation;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Fonts = typeof fonts;
export type Typography = typeof typography;
