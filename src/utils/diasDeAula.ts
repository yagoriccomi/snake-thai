/**
 * Dias de aula da academia (`academy_settings.class_weekdays`, contrato § 5.2,
 * D9): 0 = domingo … 6 = sábado, como o `extract(dow)` do banco. A semana da
 * academia vai de segunda a domingo, e é nessa ordem que a tela mostra.
 */

export interface DiaDaSemana {
  valor: number;
  rotulo: string;
}

/** Segunda a domingo, na ordem da tela (mockup "Dias de aula"). */
export const DIAS_DA_SEMANA: readonly DiaDaSemana[] = [
  { valor: 1, rotulo: 'Seg' },
  { valor: 2, rotulo: 'Ter' },
  { valor: 3, rotulo: 'Qua' },
  { valor: 4, rotulo: 'Qui' },
  { valor: 5, rotulo: 'Sex' },
  { valor: 6, rotulo: 'Sáb' },
  { valor: 0, rotulo: 'Dom' },
];

/** Padrão do banco: segunda a sábado (D9). */
export const DIAS_DE_AULA_PADRAO: readonly number[] = [1, 2, 3, 4, 5, 6];

/** Posição do dia na semana da academia (segunda = 0 … domingo = 6). */
function posicao(dia: number): number {
  return (dia + 6) % 7;
}

/** Ordena de segunda a domingo e tira repetidos (a constraint recusa repetição). */
export function ordenarDiasDeAula(dias: readonly number[]): number[] {
  return [...new Set(dias)].sort((a, b) => posicao(a) - posicao(b));
}

/**
 * Resumo para a leitura em Configurações: "Seg a Sáb" quando os dias são
 * seguidos, senão a lista ("Seg, Qua e Sex").
 */
export function resumoDosDiasDeAula(dias: readonly number[]): string {
  const ordenados = ordenarDiasDeAula(dias);
  const rotulos = ordenados.map((dia) => DIAS_DA_SEMANA.find((d) => d.valor === dia)?.rotulo ?? '?');
  if (rotulos.length === 0) return '—';
  if (rotulos.length === 1) return rotulos[0] ?? '—';
  const seguidos = ordenados.every((dia, i) => i === 0 || posicao(dia) === posicao(ordenados[i - 1] ?? dia) + 1);
  if (seguidos && rotulos.length >= 3) return `${rotulos[0]} a ${rotulos[rotulos.length - 1]}`;
  return `${rotulos.slice(0, -1).join(', ')} e ${rotulos[rotulos.length - 1]}`;
}
