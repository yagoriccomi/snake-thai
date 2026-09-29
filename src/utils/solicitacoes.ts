import type { TipoDeSolicitacao } from '@/constants/solicitacoes';

/** Prazo dos pedidos (T19): até 23:59 do 7º dia depois da aula. */
const DIAS_DE_PRAZO = 7;

/** O que acontece se o admin aprovar, dito a quem pede (§ 9.3). */
export const O_QUE_O_PEDIDO_FAZ: Readonly<Record<Exclude<TipoDeSolicitacao, 'student_was_present'>, string>> = {
  teacher_was_present: 'O admin confere e, se aprovar, a sua presença entra na chamada.',
  teacher_absence: 'O admin confere e, se aprovar, a aula fica abonada para você.',
  teacher_asks_edit: 'Conte o que está errado na chamada: o admin corrige.',
  teacher_asks_inclusion: 'O admin confere e, se aprovar, você entra na aula com presença.',
};

export interface SituacaoDoProfessorNaAula {
  escalado: boolean;
  cancelada: boolean;
  concluida: boolean;
  /** A marcação dele na chamada; `null` sem chamada ou sem linha. */
  minhaPresenca: boolean | null;
  dataDaAula: Date;
}

/** Ainda dá para pedir? O banco confere de novo, no fuso de São Paulo. */
export function dentroDoPrazoDoPedido(dataDaAula: Date, agora: Date): boolean {
  const limite = new Date(dataDaAula.getFullYear(), dataDaAula.getMonth(), dataDaAula.getDate() + DIAS_DE_PRAZO + 1);
  return agora < limite;
}

/**
 * Os pedidos ao admin que o professor vê no detalhe da aula (§ 9.3, D28,
 * D30). Só oferece o que o banco aceitaria: nunca um botão que vira recusa.
 */
export function pedidosDoProfessor(
  situacao: SituacaoDoProfessorNaAula,
  agora: Date = new Date(),
): Exclude<TipoDeSolicitacao, 'student_was_present'>[] {
  if (situacao.cancelada || !dentroDoPrazoDoPedido(situacao.dataDaAula, agora)) return [];

  if (situacao.escalado) {
    const pedidos: Exclude<TipoDeSolicitacao, 'student_was_present'>[] = [];
    if (situacao.concluida && situacao.minhaPresenca === false) pedidos.push('teacher_was_present');
    if (situacao.minhaPresenca !== true) pedidos.push('teacher_absence');
    return pedidos;
  }

  const pedidos: Exclude<TipoDeSolicitacao, 'student_was_present'>[] = [];
  if (situacao.concluida) pedidos.push('teacher_asks_edit');
  if (situacao.dataDaAula <= agora) pedidos.push('teacher_asks_inclusion');
  return pedidos;
}
