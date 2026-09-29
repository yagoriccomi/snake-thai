/**
 * Regras de TELA da chamada nova (contrato § 7.2, § 3 e mockups das linhas C e
 * G). Puras: sem React nem Supabase. Quem está na chamada e o que muda no
 * banco são decisões do banco; aqui só se agrupa, rotula e monta o envio. [#2]
 */
import type {
  AlunoDaChamada,
  EnvioDaChamada,
  OrigemNaChamada,
  ProfessorDaChamada,
} from '@/services/chamada.service';
import type { AttendanceStatus } from '@/services/classes.service';
import { diaEHora, type SeloDaAula } from '@/utils/aulasDoAluno';
import { ROTULO_DA_JUSTIFICATIVA } from '@/utils/frequency';
import type { RascunhoDeChamada } from '@/utils/rollCall';

/** Aluno incluído na tela e ainda não gravado (vem da busca). */
export interface IncluidoLocal {
  id: string;
  nome: string | null;
}

/** Uma linha da chamada: da lista do banco ou incluída agora. */
export interface LinhaDaChamada {
  userId: string;
  nome: string;
  origem: OrigemNaChamada;
  /** Nulo para quem foi incluído agora. */
  aluno: AlunoDaChamada | null;
}

export interface BlocoDaChamada {
  chave: string;
  titulo: string;
  linhas: LinhaDaChamada[];
}

/** A ordem dos blocos na tela (mockups da chamada e da chamada com trocas). */
const BLOCOS: readonly { chave: string; titulo: string; origens: readonly OrigemNaChamada[] }[] = [
  { chave: 'turma', titulo: 'Da turma', origens: ['turma', 'permanente'] },
  { chave: 'marcaram', titulo: 'Marcaram', origens: ['marcou'] },
  { chave: 'trocas', titulo: 'Trocas', origens: ['troca', 'troca_pendente'] },
  { chave: 'extras', titulo: 'Extras', origens: ['extra'] },
  { chave: 'incluidos', titulo: 'Incluídos', origens: ['incluido'] },
  { chave: 'trocaram', titulo: 'Trocaram esta aula', origens: ['trocou'] },
];

/** Na aula de rotina, quem é da grade dele sem marcação vai como falta (regra 7). */
const VIRA_FALTA: ReadonlySet<OrigemNaChamada> = new Set(['turma', 'permanente', 'troca']);

const NOME_PENDENTE = 'Aluno pendente';

export function montarBlocos(
  lista: readonly AlunoDaChamada[],
  incluidosLocais: readonly IncluidoLocal[],
): BlocoDaChamada[] {
  const linhas: LinhaDaChamada[] = [
    ...lista.map((aluno) => ({ userId: aluno.userId, nome: aluno.name ?? NOME_PENDENTE, origem: aluno.origem, aluno })),
    ...incluidosLocais.map((local) => ({
      userId: local.id,
      nome: local.nome ?? NOME_PENDENTE,
      origem: 'incluido' as const,
      aluno: null,
    })),
  ];
  return BLOCOS.map((bloco) => ({
    chave: bloco.chave,
    titulo: bloco.titulo,
    linhas: linhas.filter((linha) => bloco.origens.includes(linha.origem)),
  })).filter((bloco) => bloco.linhas.length > 0);
}

/** Quem trocou esta aula por outra só aparece para constar: não se marca. */
export function temMarcacao(origem: OrigemNaChamada): boolean {
  return origem !== 'trocou';
}

/** O selo da linha (§ 3: Troca, Troca pendente, Troca permanente, Extra, Incluído). */
export function seloDaLinha(linha: LinhaDaChamada): SeloDaAula | null {
  switch (linha.origem) {
    case 'permanente':
      return { texto: 'Troca permanente', tom: 'destaque' };
    case 'troca':
      return { texto: 'Troca', tom: 'destaque' };
    case 'troca_pendente':
      return { texto: 'Troca pendente', tom: 'aviso' };
    case 'extra':
      return { texto: 'Extra', tom: 'destaque' };
    case 'incluido':
      return { texto: 'Incluído', tom: 'neutro' };
    default:
      return null;
  }
}

/** As linhas de texto embaixo do nome, na ordem em que aparecem. */
export function detalhesDaLinha(linha: LinhaDaChamada): string[] {
  const aluno = linha.aluno;
  if (aluno === null) {
    return ['Incluído agora'];
  }
  const outra = aluno.swapOtherDateTime;
  const detalhes: string[] = [];

  switch (aluno.origem) {
    case 'troca_pendente':
      detalhes.push('Marcar presença aprova a troca.');
      break;
    case 'troca':
      if (outra !== null) detalhes.push(`No lugar de ${diaEHora(outra)}`);
      break;
    case 'trocou':
      if (outra !== null) detalhes.push(`Trocou para ${diaEHora(outra)}`);
      break;
    case 'extra':
      detalhes.push('Sem presença, não vira falta.');
      break;
    case 'marcou':
      if (aluno.scheduleMode === 'free' && aluno.weekAttended !== null && aluno.weekExpected !== null) {
        detalhes.push(`Livre ${aluno.weeklyTarget ?? ''}x · ${aluno.weekAttended} de ${aluno.weekExpected} nesta semana`);
      } else if (aluno.scheduleMode === 'unlimited') {
        detalhes.push(`À vontade · meta ${aluno.weeklyTarget ?? '—'} por semana`);
      } else {
        detalhes.push('Marcou');
      }
      break;
    default:
      break;
  }

  if (aluno.origem === 'turma' && aluno.swapRole === 'origem' && aluno.swapStatus === 'pending' && outra !== null) {
    detalhes.push(`Troca pendente para ${diaEHora(outra)}`);
  }
  if (aluno.declaredStatus === 'absent' && aluno.status === null) {
    detalhes.push('Avisou que não vem');
  }
  if (aluno.justificationStatus !== null) {
    detalhes.push(ROTULO_DA_JUSTIFICATIVA[aluno.justificationStatus]);
  }
  return detalhes;
}

/** A chamada gravada, por aluno, para o rascunho comparar. */
export function gravadoDaLista(lista: readonly AlunoDaChamada[]): Record<string, AttendanceStatus> {
  const gravado: Record<string, AttendanceStatus> = {};
  for (const aluno of lista) {
    if (aluno.status !== null) gravado[aluno.userId] = aluno.status;
  }
  return gravado;
}

export interface ContagemDaChamada {
  presentes: number;
  faltas: number;
  /** Sem marcação que vira falta (os da grade, regra 7). */
  semMarcacaoFalta: number;
  /** Sem marcação que fica sem registro (marcou, extra, troca pendente). */
  semMarcacaoSemRegistro: number;
}

export function contarDaChamada(linhas: readonly LinhaDaChamada[], rascunho: RascunhoDeChamada): ContagemDaChamada {
  const contagem: ContagemDaChamada = { presentes: 0, faltas: 0, semMarcacaoFalta: 0, semMarcacaoSemRegistro: 0 };
  for (const linha of linhas) {
    if (!temMarcacao(linha.origem)) continue;
    const marca = rascunho[linha.userId] ?? null;
    if (marca === 'present') contagem.presentes += 1;
    else if (marca === 'absent') contagem.faltas += 1;
    else if (VIRA_FALTA.has(linha.origem)) contagem.semMarcacaoFalta += 1;
    else contagem.semMarcacaoSemRegistro += 1;
  }
  return contagem;
}

interface MontarEnvioParams {
  linhas: readonly LinhaDaChamada[];
  rascunho: RascunhoDeChamada;
  /** Incluídos já gravados que a pessoa retirou da chamada. */
  retirados: ReadonlySet<string>;
  professores: readonly ProfessorDaChamada[];
  /** Presença de cada professor na tela (inclusive os acrescentados agora). */
  presencaDosProfessores: Readonly<Record<string, boolean>>;
  motivoId: string | null;
}

/**
 * O envio de `salvar_chamada_v2` (§ 7.2):
 * - da grade (turma, permanente, troca), sem marcação vira falta (regra 7);
 * - quem já tinha registro e ficou sem marcação na tela mantém o registro
 *   (a lista precisa estar completa, regra 2);
 * - marcou, extra e troca pendente sem marcação ficam sem registro;
 * - quem trocou a aula não é enviado.
 */
export function montarEnvio({
  linhas,
  rascunho,
  retirados,
  professores,
  presencaDosProfessores,
  motivoId,
}: MontarEnvioParams): EnvioDaChamada {
  const envio: EnvioDaChamada = {
    presentes: [],
    ausentes: [],
    professoresPresentes: [],
    professoresAusentes: [],
    removerIncluidos: [],
    motivoId,
  };
  for (const linha of linhas) {
    if (!temMarcacao(linha.origem)) continue;
    if (retirados.has(linha.userId)) {
      envio.removerIncluidos.push(linha.userId);
      continue;
    }
    const marca = rascunho[linha.userId] ?? null;
    const status = marca ?? (VIRA_FALTA.has(linha.origem) && linha.aluno !== null ? 'absent' : linha.aluno?.status ?? null);
    if (status === 'present') envio.presentes.push(linha.userId);
    else if (status === 'absent') envio.ausentes.push(linha.userId);
  }
  const ids = new Set([...professores.map((p) => p.teacherId), ...Object.keys(presencaDosProfessores)]);
  for (const id of ids) {
    const presente = presencaDosProfessores[id] ?? professores.find((p) => p.teacherId === id)?.present ?? null;
    if (presente === true) envio.professoresPresentes.push(id);
    else if (presente === false) envio.professoresAusentes.push(id);
  }
  return envio;
}

/** Professores ainda sem presença marcada (a lista precisa ir completa, regra 2). */
export function professoresSemMarcacao(
  professores: readonly ProfessorDaChamada[],
  presencaDosProfessores: Readonly<Record<string, boolean>>,
): number {
  return professores.filter((p) => (presencaDosProfessores[p.teacherId] ?? p.present) === null).length;
}

export type EstadoNaChamada = AttendanceStatus | 'retirado' | null;

export interface MudancaDeAluno {
  userId: string;
  nome: string;
  antes: EstadoNaChamada;
  depois: EstadoNaChamada;
}

export interface MudancaDeProfessor {
  teacherId: string;
  nome: string;
  antes: boolean | null;
  depois: boolean;
}

/** O que muda em relação ao gravado: a lista da folha Retificar. */
export function mudancasDaChamada(
  linhas: readonly LinhaDaChamada[],
  envio: EnvioDaChamada,
  professores: readonly ProfessorDaChamada[],
  nomesDosAcrescentados: Readonly<Record<string, string>>,
): { alunos: MudancaDeAluno[]; professores: MudancaDeProfessor[] } {
  const porId = new Map(linhas.map((linha) => [linha.userId, linha]));
  const alunos: MudancaDeAluno[] = [];
  const registrar = (id: string, depois: EstadoNaChamada): void => {
    const linha = porId.get(id);
    const antes = linha?.aluno?.status ?? null;
    const novo = linha?.aluno === null;
    if (antes !== depois || novo) {
      alunos.push({ userId: id, nome: linha?.nome ?? NOME_PENDENTE, antes, depois });
    }
  };
  envio.presentes.forEach((id) => registrar(id, 'present'));
  envio.ausentes.forEach((id) => registrar(id, 'absent'));
  envio.removerIncluidos.forEach((id) => registrar(id, 'retirado'));

  const mudancasDeProfessores: MudancaDeProfessor[] = [];
  const comparar = (id: string, depois: boolean): void => {
    const professor = professores.find((p) => p.teacherId === id);
    const antes = professor?.present ?? null;
    if (antes !== depois) {
      mudancasDeProfessores.push({
        teacherId: id,
        nome: professor?.name ?? nomesDosAcrescentados[id] ?? 'Professor',
        antes,
        depois,
      });
    }
  };
  envio.professoresPresentes.forEach((id) => comparar(id, true));
  envio.professoresAusentes.forEach((id) => comparar(id, false));

  return { alunos, professores: mudancasDeProfessores };
}

/** Rótulo curto de um estado, para a folha Retificar. */
export function rotuloDoEstado(estado: EstadoNaChamada): string {
  if (estado === 'present') return 'Presença';
  if (estado === 'absent') return 'Falta';
  if (estado === 'retirado') return 'Retirado';
  return 'Sem registro';
}

/**
 * T14: dias de calendário entre a data da aula e a primeira conclusão. Só
 * aparece com mais de zero ("Feita X dias depois").
 */
export function diasDepoisDaAula(aulaIso: string, concluidaIso: string): number {
  const dia = (iso: string): number => {
    const data = new Date(iso);
    return Date.UTC(data.getFullYear(), data.getMonth(), data.getDate());
  };
  return Math.max(0, Math.round((dia(concluidaIso) - dia(aulaIso)) / 86_400_000));
}

export function textoFeitaDepois(dias: number): string | null {
  if (dias <= 0) return null;
  return dias === 1 ? 'Feita 1 dia depois' : `Feita ${dias} dias depois`;
}

/** A frase de confirmação antes de concluir (a regra 7, dita para a pessoa). */
export function confirmacaoDeConclusao(contagem: ContagemDaChamada): string {
  const partes = [`Serão registradas ${contagem.presentes} presença(s) e ${contagem.faltas + contagem.semMarcacaoFalta} falta(s).`];
  if (contagem.semMarcacaoFalta > 0) {
    partes.push(`${contagem.semMarcacaoFalta} aluno(s) da grade sem marcação serão registrados como falta.`);
  }
  if (contagem.semMarcacaoSemRegistro > 0) {
    partes.push(`${contagem.semMarcacaoSemRegistro} sem marcação que não são da grade ficam sem registro.`);
  }
  return partes.join('\n\n');
}
