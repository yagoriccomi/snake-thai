/**
 * Dublê do cliente Supabase para testes unitários.
 *
 * O cliente real encadeia métodos (`from().select().eq().single()`) e resolve
 * sempre no mesmo formato `{ data, error }`. Este mock respeita esse contrato
 * de propósito: um dublê que devolvesse formato diferente do real daria falsa
 * sensação de segurança — o teste passaria e a produção quebraria [#45].
 *
 * Nenhum teste unitário toca rede ou banco de verdade [#48].
 */

/** Formato de resposta do supabase-js: dado OU erro, nunca os dois. */
export interface SupabaseResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/** Encadeamento de query com as chamadas registradas para inspeção. */
export interface QueryChainMock {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  then: (onfulfilled: (value: SupabaseResult) => unknown) => Promise<unknown>;
}

/**
 * Cria um encadeamento que resolve sempre no resultado informado.
 *
 * Todos os métodos intermediários devolvem o próprio encadeamento, e o objeto é
 * *thenable* — assim `await from().select().order()` funciona igual ao cliente
 * real, sem precisar de `.single()` no fim.
 *
 * @param result O `{ data, error }` que a query deve resolver.
 */
export function createQueryChain(result: SupabaseResult): QueryChainMock {
  const chain = {} as QueryChainMock;
  const passthrough = (): QueryChainMock => chain;

  chain.select = jest.fn(passthrough);
  chain.insert = jest.fn(passthrough);
  chain.update = jest.fn(passthrough);
  chain.delete = jest.fn(passthrough);
  chain.eq = jest.fn(passthrough);
  chain.in = jest.fn(passthrough);
  chain.order = jest.fn(passthrough);
  chain.limit = jest.fn(passthrough);
  chain.single = jest.fn(async () => result);
  chain.maybeSingle = jest.fn(async () => result);
  chain.then = (onfulfilled) => Promise.resolve(result).then(onfulfilled);

  return chain;
}

/** Erro no formato que o PostgREST devolve quando a RLS recusa a operação. */
export const RLS_DENIED: SupabaseResult = {
  data: null,
  error: {
    message: 'new row violates row-level security policy',
    code: '42501',
  },
};

/** Erro devolvido pelo trigger que impede remover o último administrador. */
export const LAST_ADMIN_BLOCKED: SupabaseResult = {
  data: null,
  error: {
    message:
      'Operacao negada: este e o ultimo administrador ativo. Promova outro antes.',
    code: '23514',
  },
};

/** Falha de transporte — servidor fora do ar, sem internet, timeout. */
export const NETWORK_FAILURE: SupabaseResult = {
  data: null,
  error: { message: 'TypeError: Network request failed' },
};
