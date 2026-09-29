import type { AttendanceStatus } from '@/services/classes.service';

/** Marcação de um aluno na tela de chamada; `null` = ainda não marcado. */
export type Marcacao = AttendanceStatus | null;

/** Marcações feitas na tela, por id do aluno. Fora do mapa = sem marcação. */
export type RascunhoDeChamada = Readonly<Record<string, Marcacao>>;

/** Tocar no símbolo já marcado desmarca; tocar no outro troca. */
export function alternarMarcacao(atual: Marcacao, tocada: AttendanceStatus): Marcacao {
  return atual === tocada ? null : tocada;
}
