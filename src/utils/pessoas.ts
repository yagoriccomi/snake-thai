import type { Profile } from '@/types/models';

/** O que a lista precisa de cada pessoa (a lista não traz celular nem nascimento). */
type PessoaDaLista = Pick<Profile, 'role' | 'name' | 'cpf' | 'status' | 'is_first_login'>;
import { diaEHora } from '@/utils/aulasDoAluno';

/** As abas da tela Pessoas (opção A dos mockups da linha E). */
export type AbaDePessoas = 'alunos' | 'equipe';

/** Os filtros da aba Alunos: situação, nunca cargo. */
export type FiltroDeAlunos = 'ativos' | 'pendentes' | 'trancados';

export type SituacaoDaPessoa = 'ativo' | 'primeiro_acesso' | 'trancado';

/** Iniciais para o avatar a partir do nome (ou '•' quando ainda não há nome). */
export function iniciais(nome: string | null): string {
  if (nome === null) return '•';
  const partes = nome.trim().split(/\s+/).filter((parte) => parte.length > 0);
  const primeira = partes[0];
  if (primeira === undefined) return '•';
  if (partes.length === 1) return primeira.slice(0, 2).toUpperCase();
  const ultima = partes[partes.length - 1] ?? primeira;
  return ((primeira[0] ?? '') + (ultima[0] ?? '')).toUpperCase();
}

/** Trancado vence; depois, quem ainda não entrou (P1 do plano do 4.10). */
export function situacaoDaPessoa(pessoa: Pick<Profile, 'status' | 'is_first_login'>): SituacaoDaPessoa {
  if (pessoa.status !== 'active') return 'trancado';
  return pessoa.is_first_login ? 'primeiro_acesso' : 'ativo';
}

export const ROTULO_DA_SITUACAO: Readonly<Record<SituacaoDaPessoa, string>> = {
  ativo: 'Ativo',
  primeiro_acesso: '1º acesso',
  trancado: 'Trancado',
};

export function ehDaEquipe(pessoa: Pick<Profile, 'role'>): boolean {
  return pessoa.role === 'professor' || pessoa.role === 'admin';
}

/** "Ativos" inclui quem ainda não entrou; "Pendentes" é só esse recorte. */
function passaNoFiltro(pessoa: PessoaDaLista, filtro: FiltroDeAlunos): boolean {
  const situacao = situacaoDaPessoa(pessoa);
  if (filtro === 'trancados') return situacao === 'trancado';
  if (filtro === 'pendentes') return situacao === 'primeiro_acesso';
  return situacao !== 'trancado';
}

function passaNaBusca(pessoa: PessoaDaLista, busca: string): boolean {
  const termo = busca.trim().toLowerCase();
  if (termo === '') return true;
  const digitos = termo.replace(/\D/g, '');
  return (
    (pessoa.name ?? '').toLowerCase().includes(termo) ||
    (digitos !== '' && (pessoa.cpf ?? '').includes(digitos))
  );
}

export interface RecorteDePessoas {
  aba: AbaDePessoas;
  filtro: FiltroDeAlunos;
  busca: string;
}

/** A lista da aba, pela busca (nome ou CPF) e, nos alunos, pelo filtro. */
export function filtrarPessoas<T extends PessoaDaLista>(pessoas: readonly T[], recorte: RecorteDePessoas): T[] {
  return pessoas.filter((pessoa) => {
    const daAba = recorte.aba === 'equipe' ? ehDaEquipe(pessoa) : pessoa.role === 'user';
    if (!daAba || !passaNaBusca(pessoa, recorte.busca)) return false;
    return recorte.aba === 'equipe' || passaNoFiltro(pessoa, recorte.filtro);
  });
}

export interface ContagemDePessoas {
  alunos: number;
  equipe: number;
  pendentes: number;
  trancados: number;
}

export function contarPessoas(pessoas: readonly PessoaDaLista[]): ContagemDePessoas {
  const alunos = pessoas.filter((pessoa) => pessoa.role === 'user');
  return {
    alunos: alunos.length,
    equipe: pessoas.filter(ehDaEquipe).length,
    pendentes: alunos.filter((pessoa) => situacaoDaPessoa(pessoa) === 'primeiro_acesso').length,
    trancados: alunos.filter((pessoa) => situacaoDaPessoa(pessoa) === 'trancado').length,
  };
}

/** Um período de turma do mês, como `perfil_do_aluno.turmas_no_mes` o devolve. */
export interface TurmaNoMes {
  turma: string;
  /** `AAAA-MM-DD`. */
  desde: string;
  /** `AAAA-MM-DD`; nulo no período aberto. */
  ate: string | null;
}

function diaMes(dataIso: string): string {
  return `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`;
}

/**
 * A turma por período do mês (§ 3, D58), separada por " · ". Ex.:
 * "Turma Noite até 15/09 · Turma Manhã desde 15/09". `inicioDoMes` em `AAAA-MM-01`.
 */
export function turmaPorPeriodo(periodos: readonly TurmaNoMes[], inicioDoMes: string): string | null {
  if (periodos.length === 0) return null;
  const partes = periodos.map(({ turma, desde, ate }) => {
    const comecouNoMes = desde >= inicioDoMes;
    if (!comecouNoMes) return ate === null ? turma : `${turma} até ${diaMes(ate)}`;
    return ate === null ? `${turma} desde ${diaMes(desde)}` : `${turma} de ${diaMes(desde)} a ${diaMes(ate)}`;
  });
  const ultimo = periodos[periodos.length - 1];
  if (ultimo !== undefined && ultimo.ate !== null) partes.push(`Sem turma desde ${diaMes(ultimo.ate)}`);
  return partes.join(' · ');
}

/** O aviso antes de salvar a turma nova (§ 3, D58); nulo quando a turma não muda. */
export function avisoDeMudancaDeTurma(turmaAtual: string | null, turmaNova: string | null): string | null {
  if (turmaAtual === turmaNova) return null;
  const cancelaTrocas =
    'Trocas de aula que saem de aulas futuras e trocas permanentes deste aluno serão canceladas.';
  if (turmaAtual !== null && turmaNova !== null) {
    return `A frequência continua contando as aulas da ${turmaAtual} até agora e passa a contar as da ${turmaNova} a partir de agora. ${cancelaTrocas}`;
  }
  if (turmaAtual !== null) {
    return `A frequência continua contando as aulas da ${turmaAtual} até agora. ${cancelaTrocas}`;
  }
  return `As aulas da ${turmaNova ?? ''} passam a contar a partir de agora.`;
}

/** A situação de uma aula no histórico do aluno (§ 12): a original trocada não é falta. */
export function rotuloDaAulaDoAluno(aula: {
  cancelled: boolean;
  status: 'present' | 'absent' | null;
  origem: string | null;
  justificationStatus: 'pending' | 'approved' | 'rejected' | null;
  swapOtherDateTime: string | null;
}): string {
  if (aula.cancelled) return 'Cancelada';
  if (aula.origem === 'trocou' && aula.swapOtherDateTime !== null) return `Trocou para ${diaEHora(aula.swapOtherDateTime)}`;
  if (aula.status === 'present') return 'Presente';
  if (aula.status === 'absent') return aula.justificationStatus === 'approved' ? 'Falta justificada' : 'Falta';
  return 'Sem registro';
}

/** A situação do professor numa aula (§ 12, T32): sem marcação não é falta (§ 15). */
export function rotuloDaAulaDoProfessor(aula: { cancelled: boolean; present: boolean | null; addedInRollCall: boolean }): string {
  if (aula.cancelled) return 'Cancelada';
  if (aula.present === true) return aula.addedInRollCall ? 'Deu a aula (fora da escala)' : 'Deu a aula';
  if (aula.present === false) return 'Falta';
  return 'Sem registro';
}
