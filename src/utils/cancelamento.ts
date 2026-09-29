import type { PreviaDosAvisos } from '@/services/cancelamento.service';

/** "a", "a e b", "a, b e c". */
export function juntarComE(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Quem recebe o aviso, em frase (mockup "Cancelar aula"). */
export function listaDosAvisados(previa: PreviaDosAvisos): string {
  const partes: string[] = [];
  if (previa.fixos > 0) partes.push(contar(previa.fixos, 'aluno fixo', 'alunos fixos'));
  if (previa.livres > 0) partes.push(contar(previa.livres, 'aluno livre', 'alunos livres'));
  if (previa.alunosDoEvento > 0) partes.push(contar(previa.alunosDoEvento, 'aluno', 'alunos'));
  if (previa.professores.length > 0) {
    partes.push(`${juntarComE(previa.professores)} (${previa.professores.length === 1 ? 'professor da aula' : 'professores da aula'})`);
  }
  if (previa.admins > 0) partes.push(contar(previa.admins, 'admin', 'admins'));
  return juntarComE(partes);
}

/**
 * O aviso da folha (D25, T22): antes da aula, o cancelamento sai na hora,
 * mesmo à noite; depois dela, só a equipe e os admins; a reativação respeita
 * o silêncio das 22h às 7h.
 */
export function textoDaPrevia(previa: PreviaDosAvisos, acao: 'cancelar' | 'reativar'): string {
  const lista = listaDosAvisados(previa);
  if (lista === '') {
    return 'Ninguém será avisado.';
  }
  if (acao === 'reativar') {
    return `O aviso vai para: ${lista}, respeitando o silêncio das 22h às 7h.`;
  }
  return previa.antesDaAula
    ? `A aula ainda não aconteceu. O aviso sai agora, mesmo à noite, para: ${lista}.`
    : `A aula já aconteceu. O aviso vai só para a equipe: ${lista}.`;
}
