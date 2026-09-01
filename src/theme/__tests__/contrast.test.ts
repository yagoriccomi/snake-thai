import { darkColors, lightColors, type ColorScheme } from '@/theme/colors';

/**
 * Guarda de contraste (WCAG 2.1, critério 1.4.3).
 *
 * Existe porque contraste é o tipo de regressão que ninguém percebe revisando
 * código: alguém troca um verde por outro "quase igual", o tema escuro continua
 * lindo, e no claro o texto some. Este teste falha antes disso chegar ao APK.
 */

/** Converte `#RRGGBB` nos três canais inteiros. */
function toRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** Linearização de canal conforme a fórmula de luminância relativa do WCAG. */
function linearize(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa de uma cor hexadecimal. */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map(linearize) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste entre duas cores, de 1:1 a 21:1. */
function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Mínimo para texto normal (WCAG AA, critério 1.4.3). */
const MIN_TEXT_RATIO = 4.5;

/** Mínimo para componentes de interface e texto grande (critério 1.4.11). */
const MIN_UI_RATIO = 3;

/** Cores que aparecem como TEXTO sobre o fundo da tela. */
const TEXT_TOKENS: ReadonlyArray<keyof ColorScheme> = [
  'textPrimary',
  'textSecondary',
  'primaryText',
  'error',
  'success',
  'warning',
];

describe.each([
  ['tema escuro', darkColors],
  ['tema claro', lightColors],
])('contraste — %s', (_nome, palette) => {
  TEXT_TOKENS.forEach((token) => {
    it(`deveTerContrasteDeTextoSuficienteEm_${String(token)}_sobreOFundo`, () => {
      const ratio = contrastRatio(palette[token], palette.background);
      expect(ratio).toBeGreaterThanOrEqual(MIN_TEXT_RATIO);
    });

    it(`deveTerContrasteDeTextoSuficienteEm_${String(token)}_sobreASuperficie`, () => {
      const ratio = contrastRatio(palette[token], palette.surface);
      expect(ratio).toBeGreaterThanOrEqual(MIN_TEXT_RATIO);
    });
  });

  it('deveGarantirLeituraDoRotuloDentroDoBotaoPrimario', () => {
    // O texto do botão é medido contra o preenchimento, não contra o fundo.
    const ratio = contrastRatio(palette.onPrimary, palette.primary);
    expect(ratio).toBeGreaterThanOrEqual(MIN_TEXT_RATIO);
  });

  it('deveDistinguirOPreenchimentoPrimarioDoFundoDaTela', () => {
    const ratio = contrastRatio(palette.primary, palette.background);
    expect(ratio).toBeGreaterThanOrEqual(MIN_UI_RATIO);
  });
});
