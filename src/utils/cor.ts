/**
 * Cor da pessoa no trilho das aulas (professor sempre; admin opcional, § 4).
 * Um lugar só para o formato, que antes estava repetido em cada tela. [#6]
 */

/** Formato aceito pelo banco (`profiles_color_hex_format`): `#RRGGBB`. */
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/** Mensagem da cor fora do formato, igual em todas as telas. */
export const MENSAGEM_COR_INVALIDA = 'Cor inválida — use o formato #RRGGBB.';

/** Ponto de partida sugerido ao cadastrar um professor (o admin troca). */
export const COR_SUGERIDA = '#39FF14';

/** `true` quando o texto é uma cor `#RRGGBB`. */
export function ehCorValida(valor: string): boolean {
  return HEX_COLOR_REGEX.test(valor);
}
