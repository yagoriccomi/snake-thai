import type { Json } from '@/types/database.types';

/**
 * Leitura do `jsonb` que as funções do banco devolvem.
 *
 * O tipo gerado é só `Json`: sem conferir, um campo renomeado numa migration
 * viraria `undefined` na tela sem erro nenhum. Aqui o formato inesperado
 * falha alto, com o nome da função, e a tela mostra erro em vez de número
 * errado. [#51]
 */

/** Objeto JSON devolvido por uma função do banco. */
export type ObjetoDoBanco = { [campo: string]: Json | undefined };

function respostaInesperada(origem: string, campo?: string): Error {
  return new Error(
    campo === undefined
      ? `Resposta inesperada do banco (${origem}).`
      : `Resposta inesperada do banco (${origem}.${campo}).`,
  );
}

/**
 * Garante que a resposta é um objeto.
 *
 * @param valor O `data` do `supabase.rpc`.
 * @param origem Nome da função, para a mensagem de erro.
 */
export function comoObjeto(valor: Json, origem: string): ObjetoDoBanco {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw respostaInesperada(origem);
  }
  return valor;
}

/** Lê um campo inteiro obrigatório. */
export function lerInteiro(objeto: ObjetoDoBanco, campo: string, origem: string): number {
  const valor = objeto[campo];
  if (typeof valor !== 'number' || !Number.isInteger(valor)) {
    throw respostaInesperada(origem, campo);
  }
  return valor;
}

/** Lê um campo booleano obrigatório. */
export function lerBooleano(objeto: ObjetoDoBanco, campo: string, origem: string): boolean {
  const valor = objeto[campo];
  if (typeof valor !== 'boolean') {
    throw respostaInesperada(origem, campo);
  }
  return valor;
}

/** Lê um campo de texto obrigatório. */
export function lerTexto(objeto: ObjetoDoBanco, campo: string, origem: string): string {
  const valor = objeto[campo];
  if (typeof valor !== 'string') {
    throw respostaInesperada(origem, campo);
  }
  return valor;
}
