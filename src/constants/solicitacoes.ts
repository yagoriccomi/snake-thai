import type { Database } from '@/types/database.types';

/**
 * Os tipos, as categorias e os rótulos das solicitações (§ 9.3, § 3), sem
 * nada de rede: as telas e os testes usam sem carregar o cliente do banco.
 */

type Enums = Database['public']['Enums'];

export type TipoDeSolicitacao = Enums['roll_call_request_kind'];
export type EstadoDaSolicitacao = Enums['justification_status'];

/** Os rótulos dos pedidos (§ 3, mockups da linha D). */
export const ROTULO_DO_PEDIDO: Readonly<Record<TipoDeSolicitacao, string>> = {
  student_was_present: 'Eu estava na aula',
  teacher_was_present: 'Eu estava na aula',
  teacher_absence: 'Justificar ausência',
  teacher_asks_edit: 'Corrigir chamada de outro professor',
  teacher_asks_inclusion: 'Me incluir nesta aula',
};

/** As categorias da caixa, na ordem da § 3. */
export const CATEGORIAS = [
  'faltas_de_alunos',
  'faltas_de_professores',
  'retificacao_de_chamadas',
  'trocas_de_aula',
  'pagamentos_de_mensalidade',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const ROTULO_DA_CATEGORIA: Readonly<Record<Categoria, string>> = {
  faltas_de_alunos: 'Faltas de alunos',
  faltas_de_professores: 'Faltas de professores',
  retificacao_de_chamadas: 'Retificação de chamadas',
  trocas_de_aula: 'Trocas de aula',
  pagamentos_de_mensalidade: 'Pagamentos de mensalidade',
};

/** O teto do motivo e da nota aceito pelo banco (§ 8). */
export const TEXTO_MAXIMO = 500;
