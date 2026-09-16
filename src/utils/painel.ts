/**
 * Apresentação dos números do Painel. Nenhuma regra de negócio aqui: os
 * valores chegam prontos do banco (docs/PAINEL.md); estas funções só dizem
 * como desenhá-los. Dinheiro sempre em centavos inteiros.
 */
import type { FaixaDeAtraso } from '@/constants/painel';
import { formatCents } from '@/utils/currency';
import { formatMonthYear } from '@/utils/datetime';

/**
 * Quanto do esperado já entrou, de 0 a 100, inteiro.
 *
 * @returns `null` sem nada esperado (não há percentual de zero).
 */
export function percentualRecebido(recebidoCents: number, esperadoCents: number): number | null {
  if (esperadoCents <= 0) {
    return null;
  }
  return Math.min(100, Math.round((recebidoCents * 100) / esperadoCents));
}

/**
 * Altura de cada barra proporcional ao maior valor, em pontos inteiros.
 * Com tudo zero, todas as barras ficam com zero (sem dividir por zero).
 */
export function alturasDasBarras(valores: readonly number[], alturaMaxima: number): number[] {
  const maior = Math.max(0, ...valores);
  if (maior === 0) {
    return valores.map(() => 0);
  }
  return valores.map((valor) => Math.round((Math.max(0, valor) * alturaMaxima) / maior));
}

/** O que o leitor de tela diz de uma coluna do gráfico. */
export function rotuloAcessivelDoMes(referenceMonth: string, esperadoCents: number, recebidoCents: number): string {
  return `${formatMonthYear(referenceMonth)}: esperado ${formatCents(esperadoCents)}, recebido ${formatCents(recebidoCents)}`;
}

/** Faixa de um atraso em dias (1 ou mais). */
export function faixaDoAtraso(dias: number): FaixaDeAtraso {
  if (dias <= 30) return '1-30';
  if (dias <= 60) return '31-60';
  return '60+';
}

/** "1 aluno" / "N alunos" e afins. */
export function contagem(n: number, singular: string, plural: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}
