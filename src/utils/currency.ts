/**
 * Utilitários de dinheiro.
 *
 * Todo valor monetário do sistema trafega e é armazenado em **centavos**
 * (`integer`). Ponto flutuante não representa 0,10 exatamente — somar
 * mensalidades em `number` decimal acumula erro e, no fechamento do mês, a
 * conta não bate (CLAUDE.md §3). A conversão para reais acontece apenas na
 * borda de exibição e de entrada do usuário.
 */

/** Quantidade de centavos que compõem uma unidade da moeda. */
const CENTS_PER_UNIT = 100;

/**
 * Formata centavos como moeda brasileira para exibição.
 *
 * @param cents Valor em centavos (ex.: 12990).
 * @returns Texto formatado (ex.: `R$ 129,90`).
 */
export function formatCents(cents: number): string {
  const value = cents / CENTS_PER_UNIT;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte o texto digitado pelo usuário em centavos.
 *
 * Aceita as formas que aparecem de fato num teclado de celular: `129,90`,
 * `129.90`, `R$ 129,90`, `1.299,90` e `129`. Casas decimais além da segunda são
 * truncadas — nunca arredondadas para cima, para não cobrar a mais do aluno.
 *
 * @param input Texto livre digitado no campo de preço.
 * @returns O valor em centavos, ou `null` se não houver número reconhecível.
 */
export function parseCurrencyToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.]/g, '').trim();
  if (cleaned === '') {
    return null;
  }

  // O último separador é o decimal; os anteriores são de milhar e somem.
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);

  let integerPart: string;
  let decimalPart: string;
  if (decimalIndex === -1) {
    integerPart = cleaned;
    decimalPart = '';
  } else {
    integerPart = cleaned.slice(0, decimalIndex);
    decimalPart = cleaned.slice(decimalIndex + 1);
  }

  const digitsOnlyInteger = integerPart.replace(/\D/g, '');
  const digitsOnlyDecimal = decimalPart.replace(/\D/g, '');

  // "1.299" sem casas decimais é mil duzentos e noventa e nove reais, não
  // um real e vinte e nove: separador de milhar não vira decimal.
  const normalizedDecimal = digitsOnlyDecimal.slice(0, 2).padEnd(2, '0');

  if (digitsOnlyInteger === '' && digitsOnlyDecimal === '') {
    return null;
  }

  const units = digitsOnlyInteger === '' ? 0 : Number(digitsOnlyInteger);
  const cents = Number(normalizedDecimal);
  return units * CENTS_PER_UNIT + cents;
}

/**
 * Converte centavos no texto editável de um campo de preço (sem símbolo).
 *
 * @param cents Valor em centavos.
 * @returns Texto no formato `129,90`, pronto para edição.
 */
export function centsToInput(cents: number): string {
  const units = Math.trunc(cents / CENTS_PER_UNIT);
  const remainder = Math.abs(cents % CENTS_PER_UNIT);
  return `${units},${String(remainder).padStart(2, '0')}`;
}
