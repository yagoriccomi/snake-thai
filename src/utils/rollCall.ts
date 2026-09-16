import type { AttendanceStatus } from '@/services/classes.service';
import type { RollCallSubmission } from '@/services/frequency.service';

/** Marcação de um aluno na tela de chamada; `null` = ainda não marcado. */
export type Marcacao = AttendanceStatus | null;

/** Marcações feitas na tela, por id do aluno. Fora do mapa = sem marcação. */
export type RascunhoDeChamada = Readonly<Record<string, Marcacao>>;

/** Tocar no símbolo já marcado desmarca; tocar no outro troca. */
export function alternarMarcacao(atual: Marcacao, tocada: AttendanceStatus): Marcacao {
  return atual === tocada ? null : tocada;
}

/** Quantos presentes, ausentes e ainda sem marcação. */
export interface ContagemDaChamada {
  presentes: number;
  ausentes: number;
  semMarcacao: number;
}

export function contarMarcacoes(
  alunoIds: readonly string[],
  rascunho: RascunhoDeChamada,
): ContagemDaChamada {
  const contagem: ContagemDaChamada = { presentes: 0, ausentes: 0, semMarcacao: 0 };
  for (const id of alunoIds) {
    const marcacao = rascunho[id] ?? null;
    if (marcacao === 'present') contagem.presentes += 1;
    else if (marcacao === 'absent') contagem.ausentes += 1;
    else contagem.semMarcacao += 1;
  }
  return contagem;
}

/**
 * O que vai ao banco ao concluir. Quem ficou sem marcação vai como FALTA: aula
 * concluída entra na frequência, e ali o aluno sem presença já contaria como
 * ausente (docs/FREQUENCIA.md). Gravar explícito deixa isso visível quando a
 * chamada for reaberta — em vez de um "sem marcação" que na conta é falta. A
 * tela avisa antes de enviar.
 */
export function montarEnvioDaChamada(
  alunoIds: readonly string[],
  rascunho: RascunhoDeChamada,
): RollCallSubmission {
  const presentes: string[] = [];
  const ausentes: string[] = [];
  for (const id of alunoIds) {
    if (rascunho[id] === 'present') presentes.push(id);
    else ausentes.push(id);
  }
  return { presentes, ausentes };
}

/** O que está na tela difere do que está gravado? */
export function houveAlteracao(
  alunoIds: readonly string[],
  rascunho: RascunhoDeChamada,
  gravado: Readonly<Record<string, AttendanceStatus>>,
): boolean {
  return alunoIds.some((id) => (rascunho[id] ?? null) !== (gravado[id] ?? null));
}
