import { ErroDeFuncao, lerErroDaFuncao, lerErroDoBanco } from '@/lib/functionsError';
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

describe('lerErroDoBanco', () => {
  it('deveUsarAMensagemDaFuncaoQuandoOCodigoEstaNaLista', () => {
    const erro = { code: '22023', message: 'Escolha para qual turma vão os alunos.', details: null, hint: null };

    const lido = lerErroDoBanco(erro, ['22023']);

    expect(lido).toBeInstanceOf(ErroDeFuncao);
    expect(describeError(lido)).toBe('Escolha para qual turma vão os alunos.');
  });

  it('deveManterOErroDeRestricaoComDetalhesDaLinha', () => {
    // A violação de CHECK do Postgres vem em inglês e com a linha inteira em
    // `details`: não pode ir para a tela.
    const restricao = {
      code: '23514',
      message: 'new row for relation "class_schedules" violates check constraint',
      details: 'Failing row contains (x, y)',
    };

    expect(lerErroDoBanco(restricao, ['23514'])).toBe(restricao);
  });

  it('deveManterOErroForaDaListaOuSemMensagem', () => {
    const outroCodigo = { code: '42501', message: 'Operação negada.' };
    const semMensagem = { code: '22023', message: '  ' };

    expect(lerErroDoBanco(outroCodigo, ['22023'])).toBe(outroCodigo);
    expect(lerErroDoBanco(semMensagem, ['22023'])).toBe(semMensagem);
    expect(lerErroDoBanco(null, ['22023'])).toBeNull();
  });
});
