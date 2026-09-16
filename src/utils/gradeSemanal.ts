/**
 * Regras de apresentação e validação da grade semanal.
 *
 * A hora é LOCAL de São Paulo e vai ao banco como texto `HH:MM`: quem converte
 * para instante é o banco. Passar por `Date` aqui usaria o fuso do aparelho. [#11]
 */
import { dateBrToIso, dateIsoToBr } from '@/utils/masks';

/** Dia da semana como o banco guarda: 0 = domingo, igual a `Date.getDay()`. */
export interface DiaDaSemana {
  value: number;
  curto: string;
  longo: string;
}

export const DIAS_DA_SEMANA: readonly DiaDaSemana[] = [
  { value: 0, curto: 'Dom', longo: 'Domingo' },
  { value: 1, curto: 'Seg', longo: 'Segunda' },
  { value: 2, curto: 'Ter', longo: 'Terça' },
  { value: 3, curto: 'Qua', longo: 'Quarta' },
  { value: 4, curto: 'Qui', longo: 'Quinta' },
  { value: 5, curto: 'Sex', longo: 'Sexta' },
  { value: 6, curto: 'Sáb', longo: 'Sábado' },
];

/** "Segunda" para 1. Fora de 0–6 devolve vazio. */
export function nomeDoDia(weekday: number): string {
  return DIAS_DA_SEMANA.find((dia) => dia.value === weekday)?.longo ?? '';
}

/** `19:00:00` (tipo `time` do Postgres) → `19:00`. */
export function horaCurta(startTime: string): string {
  return startTime.slice(0, 5);
}

/** True para uma hora `HH:MM` entre 00:00 e 23:59. */
export function horaValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

/**
 * `DD/MM/AAAA` → `AAAA-MM-DD`, conferindo o calendário (31/02 é recusado).
 *
 * @returns `null` quando a data está incompleta ou não existe.
 */
export function dataBrValidaParaIso(dataBr: string): string | null {
  const iso = dateBrToIso(dataBr);
  if (iso === null) {
    return null;
  }
  const [ano, mes, dia] = iso.split('-').map(Number);
  if (ano === undefined || mes === undefined || dia === undefined) {
    return null;
  }
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  return existe ? iso : null;
}

/** Valores do formulário de horário, como digitados. */
export interface ValoresDoHorario {
  titulo: string;
  weekday: number | null;
  hora: string;
  inicioBr: string;
  /** Vazio = sem data de fim. */
  fimBr: string;
}

/** Horário pronto para o serviço. */
export interface HorarioValidado {
  titulo: string;
  weekday: number;
  hora: string;
  inicioIso: string;
  fimIso: string | null;
}

/**
 * Confere o formulário antes de ir ao banco, com mensagem para a pessoa.
 * O banco confere de novo; aqui é para a restrição dele não chegar à tela.
 */
export function validarHorario(
  valores: ValoresDoHorario,
): { ok: true; horario: HorarioValidado } | { ok: false; mensagem: string } {
  const titulo = valores.titulo.trim();
  if (titulo === '') {
    return { ok: false, mensagem: 'Informe o título da aula.' };
  }
  if (valores.weekday === null || nomeDoDia(valores.weekday) === '') {
    return { ok: false, mensagem: 'Escolha o dia da semana.' };
  }
  if (!horaValida(valores.hora)) {
    return { ok: false, mensagem: 'Informe a hora no formato HH:MM.' };
  }
  const inicioIso = dataBrValidaParaIso(valores.inicioBr);
  if (inicioIso === null) {
    return { ok: false, mensagem: 'Informe o início da vigência (DD/MM/AAAA).' };
  }
  let fimIso: string | null = null;
  if (valores.fimBr.trim() !== '') {
    fimIso = dataBrValidaParaIso(valores.fimBr);
    if (fimIso === null) {
      return { ok: false, mensagem: 'Data de fim inválida (DD/MM/AAAA).' };
    }
    // AAAA-MM-DD compara como texto na ordem do calendário.
    if (fimIso < inicioIso) {
      return { ok: false, mensagem: 'O fim da vigência não pode ser antes do início.' };
    }
  }
  return {
    ok: true,
    horario: { titulo, weekday: valores.weekday, hora: valores.hora, inicioIso, fimIso },
  };
}

/** "Desde 01/03/2030" ou "01/03/2030 a 31/03/2030". */
export function vigenciaEmTexto(validFrom: string, validUntil: string | null): string {
  if (validUntil === null) {
    return `Desde ${dateIsoToBr(validFrom)}`;
  }
  return `${dateIsoToBr(validFrom)} a ${dateIsoToBr(validUntil)}`;
}

/** Horário ainda vale hoje ou no futuro (`hojeIso` em `AAAA-MM-DD`). */
export function horarioEstaAtivo(validUntil: string | null, hojeIso: string): boolean {
  return validUntil === null || validUntil >= hojeIso;
}

/** Nome da turma para listas, marcando a arquivada. */
export function rotuloDaTurma(turma: { name: string; archived_at: string | null }): string {
  return turma.archived_at === null ? turma.name : `${turma.name} (arquivada)`;
}

/** Contagens devolvidas ao salvar um horário. */
export interface ResultadoDoSalvamento {
  adjusted: number;
  removed: number;
  created: number;
}

function quantas(n: number, uma: string, varias: string): string {
  return n === 1 ? `1 ${uma}` : `${n} ${varias}`;
}

/**
 * Frase do que o salvamento fez com a agenda, para a pessoa conferir.
 *
 * @param editando `true` na edição de um horário existente.
 */
export function resumoDoSalvamento(resultado: ResultadoDoSalvamento, editando: boolean): string {
  const partes: string[] = [];
  if (resultado.created > 0) {
    partes.push(`${quantas(resultado.created, 'aula entrou', 'aulas entraram')} na agenda`);
  }
  if (resultado.adjusted > 0) {
    partes.push(`${quantas(resultado.adjusted, 'aula foi atualizada', 'aulas foram atualizadas')}`);
  }
  if (resultado.removed > 0) {
    partes.push(`${quantas(resultado.removed, 'aula saiu', 'aulas saíram')} da agenda`);
  }
  if (partes.length === 0) {
    return editando
      ? 'Horário salvo. Nenhuma aula futura precisou mudar.'
      : 'Horário salvo. As aulas aparecem na agenda a partir do início da vigência, até o fim do mês seguinte.';
  }
  return `Horário salvo: ${partes.join(', ')}.`;
}
