/**
 * Design tokens da marca Snake Thai — Dark Mode first.
 *
 * Centraliza cores, espaçamentos, raios e tipografia num único ponto para
 * eliminar "magic strings" de cor espalhadas pela UI e garantir consistência
 * visual. Fonte de verdade: `Identidade-Visual.md`.
 */

/** Paleta oficial (extraída da identidade visual da marca). */
export const colors = {
  /** Fundo dominante da interface (dark). */
  bgPrimary: '#0D0D0D',
  /** Superfícies elevadas: cards, formulários, modais. */
  bgSurface: '#1E1E1E',
  /** Verde neon — ações principais (CTA), status ativos, foco. */
  accentNeon: '#39FF14',
  /** Variação de verde com melhor contraste para textos/ícones. */
  accentNeonSoft: '#22C55E',
  /** Texto e contornos sobre fundo escuro. */
  textPrimary: '#FFFFFF',
  /** Texto secundário, labels e bordas sutis. */
  textSecondary: '#A1A1AA',
  /** Bordas finas translúcidas. */
  border: 'rgba(255, 255, 255, 0.15)',
  /** Acentos complementares (tags, alertas, badges de status). */
  accentBlue: '#1E3A8A',
  accentRed: '#EF4444',
  accentYellow: '#F59E0B',
} as const;

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
  md: 12,
  pill: 9999,
} as const;

/**
 * Famílias tipográficas recomendadas. As fontes são carregadas na fase de
 * implementação (ex.: `expo-font`); aqui ficam apenas os nomes canônicos.
 */
export const typography = {
  heading: 'Syne',
  body: 'Inter',
} as const;

/**
 * Área de toque mínima recomendada (dp) para elementos interativos,
 * conforme diretrizes de acessibilidade mobile (A11y).
 */
export const MIN_HIT_SLOP = 44;

/** Tema agregado, pronto para injeção em um ThemeProvider. */
export const theme = { colors, spacing, radius, typography } as const;

export type AppTheme = typeof theme;
