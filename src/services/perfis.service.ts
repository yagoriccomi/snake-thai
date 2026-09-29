import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database.types';
import type { TurmaNoMes } from '@/utils/pessoas';

/**
 * As fichas (contrato § 12, D31, D32). Quem vê o quê é do banco: o professor
 * recebe o perfil do aluno sem o plano e o financeiro; a ficha do professor
 * é só do admin. [#55]
 */

type Enums = Database['public']['Enums'];

const RECUSAS_COM_FRASE = ['22023', '23514', '42501', 'P0002'] as const;

export interface FrequenciaDoPerfil {
  percentual: number | null;
  feitas: number;
  esperadas: number;
}

export interface HorarioDaTroca {
  weekday: number;
  startTime: string;
  groupName: string | null;
}

export interface TrocaPermanenteVigente {
  de: HorarioDaTroca;
  para: HorarioDaTroca;
  desde: string;
}

export interface FinanceiroDoAluno {
  mesesNaAcademia: number;
  pagas: number;
  pagasComAtraso: number;
  inadimplentes: number;
  emAberto: number;
}

export interface PerfilDoAluno {
  nome: string | null;
  turma: string | null;
  modalidade: Enums['plan_schedule_mode'];
  cotaOuMeta: number | null;
  situacao: 'ativo' | 'primeiro_acesso' | 'trancado';
  naAcademiaDesde: string;
  frequenciaSemana: FrequenciaDoPerfil | null;
  frequenciaMes: FrequenciaDoPerfil | null;
  trocasPermanentes: TrocaPermanenteVigente[];
  turmasNoMes: TurmaNoMes[];
  /** Só para o admin. */
  planoNome: string | null;
  /** Só para o admin; nulo para o professor. */
  financeiro: FinanceiroDoAluno | null;
}

type Objeto = Record<string, Json | undefined>;

function objeto(valor: Json | undefined): Objeto | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor : null;
}

function texto(valor: Json | undefined): string | null {
  return typeof valor === 'string' ? valor : null;
}

function numero(valor: Json | undefined): number | null {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string' && valor.trim() !== '' && !Number.isNaN(Number(valor))) return Number(valor);
  return null;
}

function lista(valor: Json | undefined): Json[] {
  return Array.isArray(valor) ? valor : [];
}

function frequencia(valor: Json | undefined): FrequenciaDoPerfil | null {
  const o = objeto(valor);
  if (o === null) return null;
  return { percentual: numero(o.percentual), feitas: numero(o.feitas) ?? 0, esperadas: numero(o.esperadas) ?? 0 };
}

function horario(valor: Json | undefined): HorarioDaTroca {
  const o = objeto(valor) ?? {};
  return { weekday: numero(o.weekday) ?? 0, startTime: texto(o.start_time) ?? '', groupName: texto(o.group_name) };
}

/** O jsonb do banco vira tipos; o que faltar vira nulo, nunca um crash. [#11] */
export function lerPerfilDoAluno(dado: Json): PerfilDoAluno {
  const o = objeto(dado) ?? {};
  const financeiro = objeto(o.financeiro);
  const situacao = texto(o.situacao);
  return {
    nome: texto(o.nome),
    turma: texto(o.turma),
    modalidade: (texto(o.modalidade) ?? 'fixed') as Enums['plan_schedule_mode'],
    cotaOuMeta: numero(o.cota_ou_meta),
    situacao: situacao === 'trancado' || situacao === 'primeiro_acesso' ? situacao : 'ativo',
    naAcademiaDesde: texto(o.na_academia_desde) ?? '',
    frequenciaSemana: frequencia(o.frequencia_semana),
    frequenciaMes: frequencia(o.frequencia_mes),
    trocasPermanentes: lista(o.trocas_permanentes).map((item) => {
      const t = objeto(item) ?? {};
      return { de: horario(t.de), para: horario(t.para), desde: texto(t.desde) ?? '' };
    }),
    turmasNoMes: lista(o.turmas_no_mes).map((item) => {
      const t = objeto(item) ?? {};
      return { turma: texto(t.turma) ?? '', desde: texto(t.desde) ?? '', ate: texto(t.ate) };
    }),
    planoNome: texto(o.plano_nome),
    financeiro:
      financeiro === null
        ? null
        : {
            mesesNaAcademia: numero(financeiro.meses_na_academia) ?? 0,
            pagas: numero(financeiro.pagas) ?? 0,
            pagasComAtraso: numero(financeiro.pagas_com_atraso) ?? 0,
            inadimplentes: numero(financeiro.inadimplentes) ?? 0,
            emAberto: numero(financeiro.em_aberto) ?? 0,
          },
  };
}

export async function fetchPerfilDoAluno(userId: string): Promise<PerfilDoAluno> {
  const { data, error } = await supabase.rpc('perfil_do_aluno', { p_user_id: userId });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return lerPerfilDoAluno(data);
}

export interface AulaDoHistorico {
  classId: string;
  dateTime: string;
  title: string;
  cancelled: boolean;
  status: Enums['attendance_status'] | null;
  origem: string | null;
  justificationStatus: Enums['justification_status'] | null;
  edited: boolean;
  swapOtherDateTime: string | null;
}

export async function fetchHistoricoDoAluno(userId: string, de: string, ate: string): Promise<AulaDoHistorico[]> {
  const { data, error } = await supabase.rpc('historico_de_aulas_do_aluno', { p_user_id: userId, p_de: de, p_ate: ate });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data.map((linha) => ({
    classId: linha.class_id,
    dateTime: linha.date_time,
    title: linha.title,
    cancelled: linha.cancelled,
    status: linha.status ?? null,
    origem: linha.origem ?? null,
    justificationStatus: linha.justification_status ?? null,
    edited: linha.edited,
    swapOtherDateTime: linha.swap_other_date_time ?? null,
  }));
}

export interface PerfilDoProfessor {
  nome: string | null;
  cor: string | null;
  esperadas: number;
  dadas: number;
  dadasForaDaEscala: number;
  canceladas: number;
  faltas: number;
  abonadas: number;
  pendentes: number;
  /** T32; nulo sem esperado. */
  percentual: number | null;
}

export async function fetchPerfilDoProfessor(teacherId: string, mes: string): Promise<PerfilDoProfessor> {
  const { data, error } = await supabase.rpc('perfil_do_professor', { p_teacher_id: teacherId, p_mes: mes });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  const o = objeto(data) ?? {};
  return {
    nome: texto(o.nome),
    cor: texto(o.cor),
    esperadas: numero(o.esperadas) ?? 0,
    dadas: numero(o.dadas) ?? 0,
    dadasForaDaEscala: numero(o.dadas_fora_da_escala) ?? 0,
    canceladas: numero(o.canceladas) ?? 0,
    faltas: numero(o.faltas) ?? 0,
    abonadas: numero(o.abonadas) ?? 0,
    pendentes: numero(o.pendentes) ?? 0,
    percentual: numero(o.percentual),
  };
}

export interface AulaDoProfessor {
  classId: string;
  dateTime: string;
  title: string;
  cancelled: boolean;
  present: boolean | null;
  addedInRollCall: boolean;
}

export async function fetchHistoricoDoProfessor(teacherId: string, de: string, ate: string): Promise<AulaDoProfessor[]> {
  const { data, error } = await supabase.rpc('historico_de_aulas_do_professor', {
    p_teacher_id: teacherId,
    p_de: de,
    p_ate: ate,
  });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_FRASE);
  }
  return data.map((linha) => ({
    classId: linha.class_id,
    dateTime: linha.date_time,
    title: linha.title,
    cancelled: linha.cancelled,
    present: linha.present ?? null,
    addedInRollCall: linha.added_in_roll_call,
  }));
}
