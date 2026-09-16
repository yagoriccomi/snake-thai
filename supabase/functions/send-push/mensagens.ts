// ============================================================================
// Texto de cada notificação push — puro, sem rede, testável.
//
// Regra (docs/NOTIFICACOES.md): nada de nome, CPF ou valor. O conteúdo passa
// pela Expo e pelo Google e aparece na tela bloqueada. Título e horário da
// aula podem aparecer: não identificam ninguém.
// ============================================================================

export type TipoDeNotificacao =
  | 'mensalidade_vence_em_breve'
  | 'mensalidade_vence_hoje'
  | 'mensalidade_atrasada'
  | 'comprovante_enviado'
  | 'comprovante_aprovado'
  | 'comprovante_recusado'
  | 'justificativa_pendente'
  | 'aula_sem_chamada'
  | 'aulas_sem_chamada_resumo';

/** Canais Android criados pelo app: dá para silenciar cada um nas configurações. */
export type CanalAndroid = 'financeiro' | 'frequencia';

/** O que o banco devolve por notificação (reivindicar_notificacoes). */
export interface NotificacaoDaFila {
  kind: TipoDeNotificacao;
  data: Record<string, unknown> | null;
  payment_id: string | null;
  class_id: string | null;
  justification_id: string | null;
  class_title: string | null;
  class_date_time: string | null;
}

export interface Conteudo {
  title: string;
  body: string;
  channelId: CanalAndroid;
  /** Vai no payload para o app abrir a tela certa ao tocar. Só ids. */
  data: { tipo: TipoDeNotificacao; paymentId?: string; classId?: string; justificationId?: string };
}

const FORMATO_DA_AULA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** "10/03 às 18:00", no horário de São Paulo. */
export function quandoFoiAAula(dataHoraIso: string | null): string | null {
  if (dataHoraIso === null) return null;
  const data = new Date(dataHoraIso);
  if (Number.isNaN(data.getTime())) return null;
  const partes = Object.fromEntries(FORMATO_DA_AULA.formatToParts(data).map((p) => [p.type, p.value]));
  return `${partes.day}/${partes.month} às ${partes.hour}:${partes.minute}`;
}

function numero(data: Record<string, unknown> | null, campo: string): number | null {
  const valor = data?.[campo];
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function dias(n: number): string {
  return n === 1 ? '1 dia' : `${n} dias`;
}

function descricaoDaAula(n: NotificacaoDaFila): string {
  const quando = quandoFoiAAula(n.class_date_time);
  const titulo = n.class_title?.trim() ?? '';
  if (titulo !== '' && quando !== null) return `${titulo}, ${quando}`;
  if (titulo !== '') return titulo;
  return quando !== null ? `Aula de ${quando}` : 'Uma aula';
}

/**
 * Título, corpo, canal e payload de uma notificação.
 *
 * @param quantidade Quantas notificações iguais foram juntadas numa só
 *   (comprovantes enviados para o mesmo admin).
 */
export function conteudoDaNotificacao(n: NotificacaoDaFila, quantidade = 1): Conteudo {
  const ids = {
    ...(n.payment_id !== null ? { paymentId: n.payment_id } : {}),
    ...(n.class_id !== null ? { classId: n.class_id } : {}),
    ...(n.justification_id !== null ? { justificationId: n.justification_id } : {}),
  };
  const payload = { tipo: n.kind, ...ids };

  switch (n.kind) {
    case 'mensalidade_vence_em_breve': {
      const faltam = numero(n.data, 'dias');
      return {
        title: faltam !== null ? `Mensalidade vence em ${dias(faltam)}` : 'Mensalidade vence em breve',
        body: 'Abra o app para ver os dados do PIX e enviar o comprovante.',
        channelId: 'financeiro',
        data: payload,
      };
    }
    case 'mensalidade_vence_hoje':
      return {
        title: 'Sua mensalidade vence hoje',
        body: 'Pague pelo PIX e envie o comprovante no app.',
        channelId: 'financeiro',
        data: payload,
      };
    case 'mensalidade_atrasada': {
      const atraso = numero(n.data, 'dias');
      return {
        title: 'Mensalidade em atraso',
        body: atraso !== null
          ? `Sua mensalidade está atrasada há ${dias(atraso)}. Regularize pelo app.`
          : 'Sua mensalidade está atrasada. Regularize pelo app.',
        channelId: 'financeiro',
        data: payload,
      };
    }
    case 'comprovante_enviado':
      return {
        title: quantidade > 1 ? `${quantidade} comprovantes para analisar` : 'Novo comprovante para analisar',
        body: quantidade > 1
          ? 'Alunos enviaram comprovantes de pagamento.'
          : 'Um aluno enviou um comprovante de pagamento.',
        channelId: 'financeiro',
        data: quantidade > 1 ? { tipo: n.kind } : payload,
      };
    case 'comprovante_aprovado':
      return {
        title: 'Pagamento aprovado',
        body: 'Seu comprovante foi aprovado. Obrigado!',
        channelId: 'financeiro',
        data: payload,
      };
    case 'comprovante_recusado':
      return {
        title: 'Comprovante recusado',
        body: 'Abra o app e envie o comprovante de novo.',
        channelId: 'financeiro',
        data: payload,
      };
    case 'justificativa_pendente':
      return {
        title: 'Justificativa de falta para revisar',
        body: `${descricaoDaAula(n)}.`,
        channelId: 'frequencia',
        data: payload,
      };
    case 'aula_sem_chamada':
      return {
        title: 'Chamada pendente',
        body: `${descricaoDaAula(n)}: ainda sem chamada.`,
        channelId: 'frequencia',
        data: payload,
      };
    case 'aulas_sem_chamada_resumo': {
      const total = numero(n.data, 'quantidade') ?? 0;
      return {
        title: 'Aulas sem chamada hoje',
        body: total === 1 ? '1 aula de hoje ainda está sem chamada.' : `${total} aulas de hoje ainda estão sem chamada.`,
        channelId: 'frequencia',
        data: payload,
      };
    }
  }
}
