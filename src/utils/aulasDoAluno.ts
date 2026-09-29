/**
 * Regras de TELA das aulas do aluno (contrato § 3, § 12 e § 12.2): rótulo,
 * selo e ação de cada linha saem só das colunas que o banco devolve. Funções
 * puras, para a lista de Aulas e o menu Aulas da semana decidirem igual. [#6]
 */
import type { AulaDoAluno } from '@/services/aulas.service';
import { formatDayMonth, formatTime, formatWeekday } from '@/utils/datetime';

/** O que a linha oferece (as ações de troca chegam no 4.9b). */
export type AcaoDaAula =
  | 'nenhuma'
  | 'vou'
  | 'desmarcar'
  | 'vou-nao-vou'
  | 'vou-extra'
  | 'desmarcar-extra'
  | 'eu-estava';

export type TomDoSelo = 'neutro' | 'destaque' | 'aviso' | 'erro';

export interface SeloDaAula {
  texto: string;
  tom: TomDoSelo;
}

/** "{dia dd/mm hh:mm}" da § 3 (ex.: "qua 24/09 19:00"). */
export function diaEHora(iso: string): string {
  return `${formatWeekday(iso).toLowerCase()} ${formatDayMonth(iso)} ${formatTime(iso)}`;
}

function jaComecou(aula: AulaDoAluno, agora: Date): boolean {
  return new Date(aula.date_time).getTime() <= agora.getTime();
}

const EH_DA_GRADE: ReadonlySet<string> = new Set(['turma', 'permanente', 'troca']);

/**
 * A ação da linha pela tabela da § 12.2. Aula cancelada não tem ação (D26);
 * a que já começou só tem "Eu estava na aula", quando o banco aceita (§ 9.3).
 */
export function acaoDaAula(aula: AulaDoAluno, agora: Date = new Date()): AcaoDaAula {
  if (aula.cancelled) return 'nenhuma';
  if (jaComecou(aula, agora)) return aula.can_contest ? 'eu-estava' : 'nenhuma';

  if (aula.schedule_mode !== 'fixed' || aula.type === 'event') {
    if (aula.declared_status === 'present') return 'desmarcar';
    // Livre e à vontade só veem aula que aceita livres (T27); evento, todos.
    return aula.type === 'event' || aula.audience !== 'fixed' ? 'vou' : 'nenhuma';
  }

  if (aula.origem !== null && EH_DA_GRADE.has(aula.origem)) return 'vou-nao-vou';
  if (aula.origem === 'extra') return 'desmarcar-extra';
  if (aula.can_mark_extra) return 'vou-extra';
  return 'nenhuma';
}

/** O selo da linha (§ 3 e § 12.2). `noMenu`: o menu mostra também "Sua aula". */
export function seloDaAula(aula: AulaDoAluno, noMenu: boolean): SeloDaAula | null {
  if (aula.cancelled) return { texto: 'Cancelada', tom: 'erro' };
  switch (aula.origem) {
    case 'turma':
      return noMenu ? { texto: 'Sua aula', tom: 'neutro' } : null;
    case 'permanente':
      return { texto: 'Troca permanente', tom: 'destaque' };
    case 'troca':
      return { texto: 'Troca', tom: 'destaque' };
    case 'troca_pendente':
      return { texto: 'Troca pendente', tom: 'aviso' };
    case 'extra':
      return { texto: 'Extra', tom: 'destaque' };
    case 'marcou':
      return aula.schedule_mode === 'fixed' ? null : { texto: 'Marcada', tom: 'destaque' };
    default:
      return null;
  }
}

/** A linha de detalhe da troca e do cancelamento (§ 3, § 12.2). */
export function detalheDaAula(aula: AulaDoAluno): string | null {
  const outra = aula.swap_other_date_time;
  if (aula.origem === 'trocou' && outra !== null) return `Trocou para ${diaEHora(outra)}`;
  if (aula.origem === 'troca' && outra !== null) return `no lugar de ${diaEHora(outra)}`;
  if (aula.swap_role === 'origem' && aula.swap_status === 'pending' && outra !== null) {
    return `Troca pendente para ${diaEHora(outra)}`;
  }
  if (aula.swap_role === 'destino' && aula.swap_status === 'expired') return 'Troca expirada · vale a aula original';
  if (aula.cancelled && aula.schedule_mode === 'fixed' && aula.origem !== null && EH_DA_GRADE.has(aula.origem)) {
    return 'Aula abonada: não conta no seu mês';
  }
  return null;
}

export interface ResumoDaSemana {
  modo: AulaDoAluno['schedule_mode'];
  /** Cota (livre) ou meta (à vontade); nulo no fixo. */
  alvo: number | null;
  /** Presenças confirmadas pela chamada, em aula de rotina. */
  feitas: number;
  /** "Vou" ainda sem chamada. */
  marcadas: number;
}

/** A barra "Esta semana" (mockups da linha B) a partir das linhas da semana. */
export function resumoDaSemana(aulas: readonly AulaDoAluno[]): ResumoDaSemana | null {
  const primeira = aulas[0];
  if (primeira === undefined) return null;
  const rotina = aulas.filter((aula) => aula.type === 'routine' && !aula.cancelled);
  return {
    modo: primeira.schedule_mode,
    alvo: primeira.weekly_target,
    feitas: rotina.filter((aula) => aula.status === 'present').length,
    marcadas: rotina.filter((aula) => aula.declared_status === 'present' && aula.status === null).length,
  };
}

/** Texto da § 3 para o aviso de acima da cota, que não bloqueia. */
export function textoAcimaDaCota(marcadas: number, cota: number): string {
  return `Você marcou ${marcadas} aulas nesta semana e seu plano é ${cota}x. Pode ir: fica registrado acima do plano.`;
}

/** Segunda-feira (data local, `AAAA-MM-DD`) da semana de `data`. */
export function segundaDaSemana(data: Date): Date {
  const segunda = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  segunda.setDate(segunda.getDate() - ((segunda.getDay() + 6) % 7));
  return segunda;
}

/** O contexto da folha "Eu estava na aula" (§ 9.3). */
export function contextoDoEuEstava(aula: Pick<AulaDoAluno, 'title' | 'date_time'>): string {
  return `${aula.title} · ${diaEHora(aula.date_time)}. Se o professor aprovar, a sua presença entra na chamada.`;
}
