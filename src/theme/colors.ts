/**
 * Paletas de cores semânticas do Snake Thai (Dark Mode first).
 *
 * As chaves descrevem o PAPEL da cor (background, primary, textPrimary...),
 * não o valor — assim a UI referencia semântica e ambos os modos permanecem
 * consistentes. Valores extraídos de `Identidade-Visual.md`.
 */

/** Contrato de cores que qualquer modo (claro/escuro) deve satisfazer. */
export interface ColorScheme {
  /** Fundo dominante da tela. */
  background: string;
  /** Superfícies: cards, formulários, tab bar. */
  surface: string;
  /** Superfície mais elevada (modais, destaques). */
  surfaceElevated: string;
  /** Cor de ação/CTA (verde neon). */
  primary: string;
  /** Variação da primária no estado pressionado. */
  primaryPressed: string;
  /** Conteúdo (texto/ícone) sobre a cor primária. */
  onPrimary: string;
  /** Texto principal. */
  textPrimary: string;
  /** Texto secundário, labels e legendas. */
  textSecondary: string;
  /** Bordas sutis. */
  border: string;
  /** Bordas de maior contraste. */
  borderStrong: string;
  /** Fundo de campos de entrada. */
  inputBackground: string;
  /** Estado de erro. */
  error: string;
  /** Estado de sucesso. */
  success: string;
  /** Acento informativo. */
  info: string;
  /** Acento de alerta. */
  warning: string;
}

/** Tema escuro — identidade principal da marca (neon sobre preto profundo). */
export const darkColors: ColorScheme = {
  background: '#0D0D0D',
  surface: '#1E1E1E',
  surfaceElevated: '#262626',
  primary: '#39FF14',
  primaryPressed: '#22C55E',
  onPrimary: '#0D0D0D',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  border: 'rgba(255, 255, 255, 0.15)',
  borderStrong: 'rgba(255, 255, 255, 0.30)',
  inputBackground: '#1E1E1E',
  error: '#EF4444',
  success: '#22C55E',
  info: '#1E3A8A',
  warning: '#F59E0B',
};

/**
 * Tema claro — ajustado para contraste. Evita branco puro no fundo principal
 * (usa cinza muito claro) e troca o neon por um verde de maior contraste,
 * conforme as diretrizes de acessibilidade da marca.
 */
export const lightColors: ColorScheme = {
  background: '#F4F4F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  primary: '#22C55E',
  primaryPressed: '#16A34A',
  onPrimary: '#0D0D0D',
  textPrimary: '#0D0D0D',
  textSecondary: '#52525B',
  border: 'rgba(0, 0, 0, 0.12)',
  borderStrong: 'rgba(0, 0, 0, 0.24)',
  inputBackground: '#FFFFFF',
  error: '#DC2626',
  success: '#16A34A',
  info: '#1E3A8A',
  warning: '#D97706',
};
