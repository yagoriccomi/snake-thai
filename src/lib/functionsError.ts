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
