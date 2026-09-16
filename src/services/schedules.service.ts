import { lerErroDoBanco } from '@/lib/functionsError';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';
import { comoObjeto, lerInteiro, lerTexto } from '@/utils/jsonDoBanco';

/**
 * Grade semanal: horários fixos de uma turma. As aulas são geradas pelo banco
 * (`gerar_aulas_da_grade`); o app só lê a grade e chama as funções de salvar
 * e encerrar, que decidem o que acontece com as aulas já geradas.
 */

export type ScheduleRow = Database['public']['Tables']['class_schedules']['Row'];

/** Professor escalado num horário — nome e cor, sem dado pessoal. */
export interface ScheduleTeacherRef {
  id: string;
  name: string | null;
  color: string | null;
}

export interface ScheduleWithTeachers {
  schedule: ScheduleRow;
  teachers: ScheduleTeacherRef[];
}

/** Recusas das funções da grade que já trazem a explicação para a pessoa. */
const RECUSAS_COM_MENSAGEM = ['22023', '23514', '23505', 'P0002'] as const;

/**
 * Horários de uma turma, com os professores — três consultas no total,
 * não uma por horário. [#70]
 */
export async function fetchSchedulesForGroup(groupId: string): Promise<ScheduleWithTeachers[]> {
  const { data: horarios, error } = await supabase
    .from('class_schedules')
    .select('*')
    .eq('group_id', groupId)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true });
  if (error !== null) {
    throw error;
  }
  if (horarios.length === 0) {
    return [];
  }

  const { data: vinculos, error: erroVinculos } = await supabase
    .from('class_schedule_teachers')
    .select('schedule_id, teacher_id')
    .in('schedule_id', horarios.map((horario) => horario.id));
  if (erroVinculos !== null) {
    throw erroVinculos;
  }

  const porHorario = new Map<string, ScheduleTeacherRef[]>();
  if (vinculos.length > 0) {
    // Nome e cor do DIRETÓRIO, como nas aulas: sem CPF nem telefone. [#54]
    const { data: professores, error: erroProfessores } = await supabase
      .from('diretorio_perfis')
      .select('id, name, color')
      .in('id', [...new Set(vinculos.map((vinculo) => vinculo.teacher_id))]);
    if (erroProfessores !== null) {
      throw erroProfessores;
    }
    const professorPorId = new Map(professores.map((professor) => [professor.id, professor]));
    for (const vinculo of vinculos) {
      const professor = professorPorId.get(vinculo.teacher_id);
      if (professor === undefined) {
        continue;
      }
      const lista = porHorario.get(vinculo.schedule_id) ?? [];
      lista.push({ id: vinculo.teacher_id, name: professor.name, color: professor.color });
      porHorario.set(vinculo.schedule_id, lista);
    }
  }

  return horarios.map((schedule) => ({ schedule, teachers: porHorario.get(schedule.id) ?? [] }));
}

/** Horário a salvar. `id` nulo cria; preenchido edita. */
export interface ScheduleInput {
  id: string | null;
  groupId: string;
  title: string;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  /** `HH:MM`, hora LOCAL de São Paulo — nunca um ISO do aparelho. */
  startTime: string;
  /** `AAAA-MM-DD`. */
  validFromIso: string;
  /** `AAAA-MM-DD`; `null` = sem data de fim. */
  validUntilIso: string | null;
  teacherIds: string[];
}

/** O que o salvamento fez com as aulas. */
export interface ScheduleSaveResult {
  scheduleId: string;
  /** Aulas futuras sem chamada que mudaram de título, hora ou professores. */
  adjusted: number;
  /** Aulas futuras sem chamada que saíram por estar fora da nova vigência. */
  removed: number;
  /** Aulas que entraram na agenda (criadas ou avulsas adotadas). */
  created: number;
}

const SALVAR = 'salvar_horario_da_grade';

/** Cria ou edita um horário e gera as aulas dele (só admin). */
export async function saveSchedule(input: ScheduleInput): Promise<ScheduleSaveResult> {
  const { data, error } = await supabase.rpc(SALVAR, {
    p_group_id: input.groupId,
    p_title: input.title.trim(),
    p_weekday: input.weekday,
    p_start_time: input.startTime,
    p_valid_from: input.validFromIso,
    p_teacher_ids: input.teacherIds,
    // Omitidos em vez de nulos: no banco, o padrão deles já é nulo.
    ...(input.validUntilIso !== null ? { p_valid_until: input.validUntilIso } : {}),
    ...(input.id !== null ? { p_id: input.id } : {}),
  });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_MENSAGEM);
  }
  const resultado = comoObjeto(data, SALVAR);
  return {
    scheduleId: lerTexto(resultado, 'schedule_id', SALVAR),
    adjusted: lerInteiro(resultado, 'ajustadas', SALVAR),
    removed: lerInteiro(resultado, 'removidas', SALVAR),
    created: lerInteiro(resultado, 'criadas', SALVAR),
  };
}

export interface ScheduleEndResult {
  /** `apagado` quando o horário nem tinha começado. */
  action: 'encerrado' | 'apagado';
  removed: number;
}

const ENCERRAR = 'encerrar_horario_da_grade';

/**
 * Encerra um horário no último dia informado (`AAAA-MM-DD`). As aulas futuras
 * sem chamada depois desse dia saem da agenda; as com chamada ficam.
 */
export async function endSchedule(scheduleId: string, lastDayIso: string): Promise<ScheduleEndResult> {
  const { data, error } = await supabase.rpc(ENCERRAR, { p_id: scheduleId, p_ultimo_dia: lastDayIso });
  if (error !== null) {
    throw lerErroDoBanco(error, RECUSAS_COM_MENSAGEM);
  }
  const resultado = comoObjeto(data, ENCERRAR);
  const acao = lerTexto(resultado, 'acao', ENCERRAR);
  if (acao !== 'encerrado' && acao !== 'apagado') {
    throw new Error(`Resposta inesperada do banco (${ENCERRAR}.acao).`);
  }
  return { action: acao, removed: lerInteiro(resultado, 'removidas', ENCERRAR) };
}
