import type { AttendanceStatus } from '@/services/classes.service';
import type { RascunhoDeChamada } from '@/utils/rollCall';

/**
 * Regras do rascunho da chamada guardado no aparelho (docs/FREQUENCIA.md).
 *
 * Puro de propósito: sem React, Supabase nem armazenamento — é aqui que mora a
 * decisão de recuperar, descartar ou avisar conflito, e ela precisa de teste
 * sem mock nenhum. [#2][#30]
 */

/** Muda quando o formato gravado mudar; rascunho de outra versão é descartado. */
export const VERSAO_DO_RASCUNHO = 1;

/** Prefixo das chaves no armazenamento cifrado. */
export const PREFIXO_DO_RASCUNHO = 'rollcall_draft.';

/**
 * Rascunho sem marcação nova há mais de 7 dias é descartado: cobre a chamada
 * começada na sexta e terminada na segunda (decisão registrada no PLANO-T11).
 */
export const VALIDADE_DO_RASCUNHO_MS = 7 * 24 * 60 * 60 * 1000;

/** Toques seguidos viram uma gravação só: cada gravação escreve no Keystore. */
export const ATRASO_PARA_GUARDAR_MS = 500;

/** Marcações efetivas (sem "não marcado"), por id do aluno. */
export type MarcacoesGravadas = Readonly<Record<string, AttendanceStatus>>;

/** O que fica guardado no aparelho para uma aula. */
export interface RascunhoGuardado {
  versao: typeof VERSAO_DO_RASCUNHO;
  classId: string;
  /** Última marcação, em ISO — base da validade. */
  salvoEm: string;
  /**
   * Foto do que estava GRAVADO no banco quando o rascunho começou. É o que
   * permite perceber que outra pessoa salvou a chamada depois.
   */
  base: { marcacoes: MarcacoesGravadas; concluidaEm: string | null };
  marcacoes: MarcacoesGravadas;
}

/** O que fazer com um rascunho encontrado ao abrir a chamada. */
export type AvaliacaoDoRascunho = 'vencido' | 'identico' | 'conflito' | 'recuperar';

const CARACTERES_FORA_DA_CHAVE = /[^A-Za-z0-9_-]/g;
const STATUS_VALIDOS: readonly string[] = ['present', 'absent'];

/**
 * Chave do rascunho de um usuário numa aula. Inclui o usuário: num aparelho
 * compartilhado, a chamada de um professor não aparece para outro. Tira o que
 * o SecureStore não aceita em chave.
 */
export function chaveDoRascunho(userId: string, classId: string): string {
  const limpar = (id: string): string => id.replace(CARACTERES_FORA_DA_CHAVE, '');
  return `${PREFIXO_DO_RASCUNHO}${limpar(userId)}.${limpar(classId)}`;
}

/** Só as marcações feitas (tira os "não marcado"). */
export function somenteMarcados(rascunho: RascunhoDeChamada): Record<string, AttendanceStatus> {
  const marcados: Record<string, AttendanceStatus> = {};
  for (const [alunoId, marcacao] of Object.entries(rascunho)) {
    if (marcacao !== null) {
      marcados[alunoId] = marcacao;
    }
  }
  return marcados;
}

/** Mesmas marcações, sem importar a ordem; "não marcado" é igual a ausente. */
export function mesmasMarcacoes(a: RascunhoDeChamada, b: RascunhoDeChamada): boolean {
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const chave of chaves) {
    if ((a[chave] ?? null) !== (b[chave] ?? null)) {
      return false;
    }
  }
  return true;
}

/** Só as marcações de quem ainda está na aula (aluno que saiu da turma some). */
export function restringirAosAlunos(
  marcacoes: MarcacoesGravadas,
  alunoIds: readonly string[],
): Record<string, AttendanceStatus> {
  const naAula = new Set(alunoIds);
  const restritas: Record<string, AttendanceStatus> = {};
  for (const [alunoId, status] of Object.entries(marcacoes)) {
    if (naAula.has(alunoId)) {
      restritas[alunoId] = status;
    }
  }
  return restritas;
}

const ehObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

function lerMarcacoes(valor: unknown): MarcacoesGravadas | null {
  if (!ehObjeto(valor)) return null;
  const marcacoes: Record<string, AttendanceStatus> = {};
  for (const [alunoId, status] of Object.entries(valor)) {
    if (typeof status !== 'string' || !STATUS_VALIDOS.includes(status)) return null;
    marcacoes[alunoId] = status as AttendanceStatus;
  }
  return marcacoes;
}

/**
 * Lê o texto guardado. Qualquer coisa fora do formato — JSON quebrado, outra
 * versão, data ilegível, status desconhecido — vira `null` e é descartada:
 * rascunho duvidoso nunca vai para a chamada oficial.
 */
export function interpretarRascunhoGuardado(texto: string): RascunhoGuardado | null {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!ehObjeto(bruto) || bruto.versao !== VERSAO_DO_RASCUNHO) return null;
  if (typeof bruto.classId !== 'string' || typeof bruto.salvoEm !== 'string') return null;
  if (Number.isNaN(Date.parse(bruto.salvoEm)) || !ehObjeto(bruto.base)) return null;

  const concluidaEm = bruto.base.concluidaEm;
  if (concluidaEm !== null && typeof concluidaEm !== 'string') return null;

  const marcacoesDaBase = lerMarcacoes(bruto.base.marcacoes);
  const marcacoes = lerMarcacoes(bruto.marcacoes);
  if (marcacoesDaBase === null || marcacoes === null) return null;

  return {
    versao: VERSAO_DO_RASCUNHO,
    classId: bruto.classId,
    salvoEm: bruto.salvoEm,
    base: { marcacoes: marcacoesDaBase, concluidaEm },
    marcacoes,
  };
}

/** Passou da validade? Data ilegível conta como vencida. */
export function rascunhoVencido(
  salvoEmIso: string,
  agoraMs: number,
  validadeMs: number = VALIDADE_DO_RASCUNHO_MS,
): boolean {
  const salvoEmMs = Date.parse(salvoEmIso);
  return Number.isNaN(salvoEmMs) || agoraMs - salvoEmMs > validadeMs;
}

interface EntradaDaAvaliacao {
  guardado: RascunhoGuardado;
  /** Chamada gravada agora no banco. */
  gravado: MarcacoesGravadas;
  /** Conclusão gravada agora no banco. */
  concluidaEm: string | null;
  alunoIds: readonly string[];
  agoraMs: number;
}

/**
 * Decide o destino do rascunho ao abrir a chamada, nesta ordem:
 *
 * 1. `vencido` — passou da validade: descartar.
 * 2. `identico` — as marcações já são as gravadas: nada a recuperar.
 * 3. `conflito` — a chamada gravada mudou desde que o rascunho começou (outra
 *    pessoa salvou): perguntar antes de sobrescrever.
 * 4. `recuperar` — restaurar e avisar.
 *
 * O conflito compara a FOTO da base, e não datas: `attendance_taken_at` não
 * muda ao salvar de novo, e `updated_at` muda quando o aluno altera a própria
 * declaração. Comparar o conteúdo detecta exatamente mudança na chamada, sem
 * migration e sem depender do relógio do aparelho.
 */
export function avaliarRascunho({
  guardado,
  gravado,
  concluidaEm,
  alunoIds,
  agoraMs,
}: EntradaDaAvaliacao): AvaliacaoDoRascunho {
  if (rascunhoVencido(guardado.salvoEm, agoraMs)) {
    return 'vencido';
  }

  const gravadoNaAula = restringirAosAlunos(gravado, alunoIds);
  if (mesmasMarcacoes(restringirAosAlunos(guardado.marcacoes, alunoIds), gravadoNaAula)) {
    return 'identico';
  }

  const baseNaAula = restringirAosAlunos(guardado.base.marcacoes, alunoIds);
  if (!mesmasMarcacoes(baseNaAula, gravadoNaAula) || guardado.base.concluidaEm !== concluidaEm) {
    return 'conflito';
  }

  return 'recuperar';
}
