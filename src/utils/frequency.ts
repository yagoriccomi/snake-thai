import type { JustificationStatus } from '@/services/justifications.service';
import type { ModoDaFrequencia, SemanaDoMes } from '@/services/frequency.service';

/**
 * Percentual com vírgula decimal e sem zeros inúteis ("91,67%", "150%").
 * Nulo = esperado 0: a tela mostra "—" (contrato § 3, T9).
 *
 * Só FORMATA: o valor já chega arredondado do banco. Recalcular aqui criaria
 * uma segunda versão da regra. A frequência pode passar de 100% (D7).
 */
export function formatarPercentual(valor: number | null): string {
  if (valor === null) {
    return '—';
  }
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

/** "{a} de {e}" (contrato § 3). */
export function textoDeContagem(feitas: number, esperadas: number): string {
  return `${feitas} de ${esperadas}`;
}

/** Tom do percentual na tela: o acento a partir de 100%, o aviso abaixo. */
export type TomDoPercentual = 'acima' | 'abaixo' | 'neutro';

export function tomDoPercentual(valor: number | null): TomDoPercentual {
  if (valor === null) {
    return 'neutro';
  }
  return valor >= 100 ? 'acima' : 'abaixo';
}

/** Rótulos do cartão e da tela: no à vontade, "Meta da semana" e "Meta do mês" (§ 3). */
export function rotulosDaFrequencia(modo: ModoDaFrequencia): { semana: string; mes: string } {
  return modo === 'unlimited'
    ? { semana: 'Meta da semana', mes: 'Meta do mês' }
    : { semana: 'Semana', mes: 'Mês' };
}

function diaMes(dataIso: string): string {
  const [, mes, dia] = dataIso.split('-');
  return `${dia ?? ''}/${mes ?? ''}`;
}

function ultimoDiaDoMes(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number);
  const ultimo = new Date(ano ?? 0, mes ?? 1, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
}

/**
 * "Fecha em {dd/mm}, quando a semana extra terminar" (§ 3): só quando o mês
 * já acabou no calendário e ainda não fechou. `hoje` é `AAAA-MM-DD`.
 */
export function avisoDeMesAberto(mes: { referenceMonth: string; closesOn: string; isClosed: boolean }, hoje: string): string | null {
  if (mes.isClosed || hoje <= ultimoDiaDoMes(mes.referenceMonth)) {
    return null;
  }
  return `Fecha em ${diaMes(mes.closesOn)}, quando a semana extra terminar`;
}

/** "S1 · 01–06" ou "29/06 – 05/07" na Semana extra. */
export function periodoDaSemana(semana: Pick<SemanaDoMes, 'weekStart' | 'weekEnd' | 'isSplit'>): string {
  if (semana.isSplit) {
    return `${diaMes(semana.weekStart)} – ${diaMes(semana.weekEnd)}`;
  }
  return `${semana.weekStart.slice(8, 10)}–${semana.weekEnd.slice(8, 10)}`;
}

/** Uma linha da tabela da tela Frequência, já com o acumulado do mês. */
export interface LinhaDaSemana {
  semana: SemanaDoMes;
  /** Presenças do mês até esta semana, inclusive. */
  feitasAteAqui: number;
  /** Acumulado ÷ esperado do mês inteiro, como o mês faz (D8); nulo sem esperado. */
  percentualAteAqui: number | null;
}

/**
 * O "No mês (acumulado)" do mockup: as presenças somadas até cada semana,
 * sobre o esperado do mês INTEIRO (o exemplo do dono, D8: 3 de 8 → 37,5%).
 * As parcelas já vêm do banco; aqui só se somam na ordem.
 */
export function acumularSemanas(semanas: readonly SemanaDoMes[], esperadoDoMes: number): LinhaDaSemana[] {
  let feitas = 0;
  return semanas.map((semana) => {
    feitas += semana.attendedInMonth;
    return {
      semana,
      feitasAteAqui: feitas,
      percentualAteAqui: esperadoDoMes > 0 ? Math.round((feitas * 10000) / esperadoDoMes) / 100 : null,
    };
  });
}

/** A dica da conta, por modalidade (mockup da linha B). */
export function dicaDaConta(modo: ModoDaFrequencia): string {
  if (modo === 'fixed') {
    return 'Semana e mês: aulas feitas ÷ aulas da sua grade. Aula cancelada ou justificada sai da conta. Pode passar de 100%.';
  }
  if (modo === 'unlimited') {
    return 'Semana: aulas feitas ÷ sua meta. Mês: aulas feitas ÷ a meta do mês inteiro. Pode passar de 100%.';
  }
  return 'Semana: aulas feitas ÷ cota. Mês: aulas feitas ÷ esperado do mês inteiro. Pode passar de 100%. Abono tira 1 aula do esperado.';
}

/** Como a Semana extra se divide, por modalidade (D10, T2). */
export function explicacaoDaSemanaExtra(modo: ModoDaFrequencia): string {
  if (modo === 'fixed') {
    return 'A semana extra começa num mês e termina no outro. Cada aula da sua grade conta no mês da data dela.';
  }
  return 'A semana extra começa num mês e termina no outro. Cada aula feita fica no mês em que aconteceu; o que faltar se divide entre os dois meses, e se sobrar uma, ela fica no mês novo, onde ainda dá para compensar.';
}

/** Rótulo, para pessoas, de cada estado de uma justificativa de falta. */
export const ROTULO_DA_JUSTIFICATIVA: Readonly<Record<JustificationStatus, string>> = {
  pending: 'Justificativa em análise',
  approved: 'Justificativa aprovada',
  rejected: 'Justificativa negada',
};
