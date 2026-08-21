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
  /**
   * Verde da marca aplicado a TEXTO e ÍCONES.
   *
   * Existe separado de `primary` porque as duas cores respondem a exigências
   * diferentes de contraste: `primary` preenche botões (e o contraste é medido
   * contra `onPrimary`), enquanto esta é lida sobre o fundo da tela e precisa
   * dos 4,5:1 do WCAG 1.4.3. No tema escuro as duas coincidem — o neon sobre
   * preto tem 14,33:1 de sobra. No claro, o neon dá 2,07:1 e seria ilegível.
   */
  primaryText: string;
  /** Estado de erro. */
  error: string;
  /** Estado de sucesso — legível como texto sobre o fundo. */
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
  // 14,33:1 sobre o fundo — o neon é legível como texto no escuro.
  primaryText: '#39FF14',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  border: 'rgba(255, 255, 255, 0.15)',
  borderStrong: 'rgba(255, 255, 255, 0.30)',
  inputBackground: '#1E1E1E',
  error: '#F87171',
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
  // 3,25:1 contra o fundo (1.4.11) e 5,44:1 para o rótulo escuro dentro do
  // botão (1.4.3) — o único ponto da escala que satisfaz os dois com folga.
  primary: '#159C46',
  primaryPressed: '#15803D',
  onPrimary: '#0D0D0D',
  // #22C55E daria 2,07:1 como texto; este verde dá 4,56:1 e mantém a marca.
  primaryText: '#15803D',
  textPrimary: '#0D0D0D',
  textSecondary: '#52525B',
  border: 'rgba(0, 0, 0, 0.12)',
  borderStrong: 'rgba(0, 0, 0, 0.24)',
  inputBackground: '#FFFFFF',
  // Ajustados para 4,5:1 sobre o fundo claro (WCAG 1.4.3).
  error: '#C81E1E',
  success: '#15803D',
  info: '#1E3A8A',
  warning: '#B45309',
};
