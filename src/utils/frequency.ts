import type { JustificationStatus } from '@/services/justifications.service';

/**
 * Percentual com vírgula decimal e sem zeros inúteis ("91,67%", "100%").
 *
 * Só FORMATA: o valor já chega arredondado do banco (`frequencia_mensal`).
 * Recalcular aqui criaria uma segunda versão da regra.
 */
export function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

/** Rótulo, para pessoas, de cada estado de uma justificativa de falta. */
export const ROTULO_DA_JUSTIFICATIVA: Readonly<Record<JustificationStatus, string>> = {
  pending: 'Justificativa em análise',
  approved: 'Justificativa aprovada',
  rejected: 'Justificativa recusada',
};
