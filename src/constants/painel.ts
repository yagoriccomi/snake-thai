/**
 * Parâmetros do Painel do admin. Os mesmos valores são os padrões das funções
 * do banco (docs/PAINEL.md); mudar aqui muda o que o app pede.
 */

/** Meses no gráfico de faturamento. */
export const MESES_DO_GRAFICO = 12;

/** Abaixo deste percentual de frequência o aluno entra em risco de evasão. */
export const LIMIAR_RISCO_EVASAO_PERCENT = 70;

/** Aulas contadas no mês atual para o percentual dele valer como alerta. */
export const MIN_AULAS_PARA_RISCO = 4;

/** Alunos em risco mostrados antes de "Ver todos". */
export const ALUNOS_EM_RISCO_VISIVEIS = 5;

/** Faixas de atraso, na ordem do banco. */
export type FaixaDeAtraso = '1-30' | '31-60' | '60+';

export const FAIXAS_DE_ATRASO: readonly FaixaDeAtraso[] = ['1-30', '31-60', '60+'];

/** Como cada faixa aparece para a pessoa. */
export const ROTULO_DA_FAIXA: Readonly<Record<FaixaDeAtraso, string>> = {
  '1-30': '1 a 30 dias',
  '31-60': '31 a 60 dias',
  '60+': 'Mais de 60 dias',
};

/**
 * Nome, para o admin, de cada rotina agendada no banco (pg_cron). Rotina nova
 * sem entrada aqui aparece pelo nome técnico — melhor que sumir do aviso.
 */
export const NOME_DA_ROTINA: Readonly<Record<string, string>> = {
  'mark-overdue-payments': 'Marcar mensalidades vencidas',
  'generate-monthly-payments': 'Gerar as mensalidades do mês',
  'close-monthly-attendance': 'Fechar a frequência do mês',
  'expire-payment-proofs': 'Prazo de guarda dos comprovantes',
  'generate-scheduled-classes': 'Gerar as aulas da grade semanal',
  'push-lembretes-mensalidade': 'Notificações: lembretes de mensalidade',
  'push-aulas-sem-chamada': 'Notificações: aulas sem chamada',
  'push-resumo-aulas-sem-chamada': 'Notificações: resumo das aulas sem chamada',
  'push-despachar': 'Notificações: envio',
  'push-limpeza': 'Notificações: limpeza do histórico',
};
