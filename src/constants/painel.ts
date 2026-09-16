/**
 * Parâmetros do Painel do admin. Os mesmos valores são os padrões das funções
 * do banco (docs/PAINEL.md); mudar aqui muda o que o app pede.
 */

/** Meses no gráfico de faturamento. */
export const MESES_DO_GRAFICO = 12;

/** Abaixo deste percentual de frequência o aluno entra em risco de evasão. */
export const LIMIAR_RISCO_EVASAO_PERCENT = 50;

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
