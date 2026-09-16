import { ErroDeFuncao, lerErroDaFuncao } from '@/lib/functionsError';
import { describeError } from '@/utils/errors';

describe('lerErroDaFuncao', () => {
  it('deveTrazerAMensagemEOStatusDoCorpo', async () => {
    const erro = { name: 'FunctionsHttpError', message: 'non-2xx', context: { status: 403, json: async () => ({ error: 'Acesso restrito a administradores' }) } };

    const lido = await lerErroDaFuncao(erro);

    expect(lido).toBeInstanceOf(ErroDeFuncao);
    expect(lido).toMatchObject({ message: 'Acesso restrito a administradores', status: 403 });
    expect(describeError(lido)).toBe('Acesso restrito a administradores');
  });

  it('deveManterOErroOriginalQuandoOCorpoNaoServe', async () => {
    const semCorpo = { name: 'FunctionsFetchError', message: 'Failed to send a request' };
    const corpoQuebrado = { context: { json: async () => { throw new SyntaxError('x'); } } };
    const corpoSemMensagem = { context: { json: async () => ({ ok: false }) } };

    expect(await lerErroDaFuncao(semCorpo)).toBe(semCorpo);
    expect(await lerErroDaFuncao(corpoQuebrado)).toBe(corpoQuebrado);
    expect(await lerErroDaFuncao(corpoSemMensagem)).toBe(corpoSemMensagem);
  });
});
