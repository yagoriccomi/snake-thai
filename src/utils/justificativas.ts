import type { JustificationStatus } from '@/services/justifications.service';
import type { TomDoSelo } from '@/utils/aulasDoAluno';
import { formatDayMonth, formatFullDateTime } from '@/utils/datetime';

/** O que os rótulos precisam de uma justificativa (§ 3). */
export interface EstadoDaJustificativa {
  status: JustificationStatus;
  attempt: number;
  approvedByName: string | null;
  canResend?: boolean;
  resendUntil?: string | null;
}

/** Texto da § 3 para a 2ª negada; vem acompanhado do bloco de contato. */
export const NEGADA_PELA_SEGUNDA_VEZ =
  'Justificativa negada. Para mais informações, procure o professor da aula ou a administração da academia.';

/** A 2ª negada encerra o caminho (D42): só resta o contato da academia. */
export function negadaPelaSegundaVez(estado: EstadoDaJustificativa): boolean {
  return estado.status === 'rejected' && estado.attempt >= 2;
}

/** Rótulo da § 3 para o estado de uma justificativa. */
export function rotuloDaJustificativa(estado: EstadoDaJustificativa): string {
  if (estado.status === 'pending') {
    return 'Justificativa em análise';
  }
  if (estado.status === 'approved') {
    // D16: quem aprovou aparece; sem o nome (conta excluída), o rótulo fica sem ele.
    return estado.approvedByName !== null ? `Justificativa aprovada por ${estado.approvedByName}` : 'Justificativa aprovada';
  }
  if (negadaPelaSegundaVez(estado)) {
    return NEGADA_PELA_SEGUNDA_VEZ;
  }
  // Passado o prazo do reenvio, a data não tem mais o que prometer.
  if (estado.canResend === true && estado.resendUntil != null) {
    return `Justificativa negada · você pode reenviar até ${formatDayMonth(estado.resendUntil)}`;
  }
  return 'Justificativa negada';
}

export function tomDaJustificativa(status: JustificationStatus): TomDoSelo {
  if (status === 'approved') return 'destaque';
  if (status === 'rejected') return 'erro';
  return 'aviso';
}

/** "dd/mm" de uma data `AAAA-MM-DD`, lida como texto (sem fuso). */
function diaMesDoTexto(dataIso: string): string {
  return `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`;
}

/** Do que trata a justificativa: a aula perdida ou a semana do livre. */
export function assuntoDaJustificativa(item: {
  classTitle: string | null;
  classDateTime: string | null;
  weekStart: string;
}): string {
  if (item.classDateTime !== null) {
    return `${item.classTitle ?? 'Aula'} · ${formatFullDateTime(item.classDateTime)}`;
  }
  return `Semana de ${diaMesDoTexto(item.weekStart)}`;
}
