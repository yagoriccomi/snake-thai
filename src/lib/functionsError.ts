/**
 * Erro de Edge Function com a mensagem que o servidor mandou para a pessoa.
 *
 * O `supabase.functions.invoke` devolve um `FunctionsHttpError` genérico
 * ("Edge Function returned a non-2xx status code"); a explicação útil — "Senha
 * incorreta", "Este e-mail já está cadastrado em outra conta" — vem no corpo
 * JSON, dentro de `error.context`. Sem ler o corpo, a tela diria só "erro". [#93]
 */
export class ErroDeFuncao extends Error {
  readonly status: number | null;

  constructor(mensagem: string, status: number | null) {
    super(mensagem);
    this.name = 'ErroDeFuncao';
    this.status = status;
  }
}

interface RespostaLegivel {
  status?: number;
  json: () => Promise<unknown>;
}

const ehRespostaLegivel = (valor: unknown): valor is RespostaLegivel =>
  typeof valor === 'object' && valor !== null && typeof (valor as RespostaLegivel).json === 'function';

/**
 * Converte o erro do `functions.invoke` num `ErroDeFuncao` com a mensagem do
 * servidor. Sem corpo legível, devolve o erro original (a tela classifica).
 */
export async function lerErroDaFuncao(erro: unknown): Promise<unknown> {
  const contexto = (erro as { context?: unknown } | null)?.context;
  if (!ehRespostaLegivel(contexto)) {
    return erro;
  }
  try {
    const corpo = (await contexto.json()) as { error?: unknown } | null;
    const mensagem = typeof corpo?.error === 'string' ? corpo.error.trim() : '';
    if (mensagem !== '') {
      return new ErroDeFuncao(mensagem, typeof contexto.status === 'number' ? contexto.status : null);
    }
  } catch {
    // Corpo que não é JSON: fica o erro original.
  }
  return erro;
}

/**
 * Mensagem escrita para a pessoa por uma função do BANCO (RPC).
 *
 * As funções de turma e da grade recusam com `raise exception` em português
 * ("Esta turma já tem um horário nesse dia e hora."). Sem isto, a tela
 * trocaria a explicação pela genérica do SQLSTATE. Só passa o erro dos códigos
 * informados e SEM `details`: violação de restrição do Postgres traz
 * `details` ("Failing row contains (...)", com dados da linha) e continua com
 * a mensagem genérica. [#93]
 *
 * @param erro O erro devolvido pelo `supabase.rpc`.
 * @param codigos SQLSTATEs cujas mensagens a função escreveu para a pessoa.
 */
export function lerErroDoBanco(erro: unknown, codigos: readonly string[]): unknown {
  if (typeof erro !== 'object' || erro === null) {
    return erro;
  }
  const { code, message, details } = erro as { code?: unknown; message?: unknown; details?: unknown };
  if (typeof code !== 'string' || !codigos.includes(code)) {
    return erro;
  }
  if (typeof details === 'string' && details.trim() !== '') {
    return erro;
  }
  if (typeof message !== 'string' || message.trim() === '') {
    return erro;
  }
  return new ErroDeFuncao(message.trim(), null);
}
