import { createLogger } from '@/lib/logger';

/** Lê o JSON que o logger emitiu no console. */
function ultimoEvento(spy: jest.SpyInstance): Record<string, unknown> {
  const bruto = spy.mock.calls[spy.mock.calls.length - 1]?.[0] as string;
  return JSON.parse(bruto) as Record<string, unknown>;
}

describe('logger — preservação da causa', () => {
  let erroSpy: jest.SpyInstance;

  beforeEach(() => {
    erroSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    erroSpy.mockRestore();
  });

  it('deveGuardarAMensagemEAPilhaDeUmError', () => {
    createLogger('teste').error('falhou', new Error('conexão recusada'));
    const evento = ultimoEvento(erroSpy);
    expect(evento.errorMessage).toBe('conexão recusada');
    expect(evento.errorName).toBe('Error');
  });

  it('naoDevePerderOConteudoQuandoRecebeUmObjetoNoLugarDoErro', () => {
    // Regressão de um caso real: um envio de comprovante falhou em produção e
    // o log registrou apenas "[object Object]" — sem NENHUMA pista da causa,
    // porque `String({...})` descarta o objeto inteiro. Chamar assim é uso
    // errado da API, mas o log é a última linha de defesa: ele não pode
    // destruir a única evidência que restou.
    createLogger('teste').error('falhou', { code: '42501', message: 'RLS negou' });
    const evento = ultimoEvento(erroSpy);
    expect(evento.errorMessage).not.toBe('[object Object]');
    expect(String(evento.errorMessage)).toContain('42501');
    expect(String(evento.errorMessage)).toContain('RLS negou');
  });

  it('naoDeveQuebrarComReferenciaCircular', () => {
    const circular: Record<string, unknown> = { nome: 'raiz' };
    circular.self = circular;
    // Um log que lança exceção esconde justamente o erro que ia explicar tudo.
    expect(() => createLogger('teste').error('falhou', circular)).not.toThrow();
    expect(String(ultimoEvento(erroSpy).errorMessage)).toContain('raiz');
  });

  it('deveMascararDadoPessoalNoContexto', () => {
    createLogger('teste').error('falhou', new Error('x'), {
      cpf: '12345678900',
      paymentId: 'pay-1',
    });
    const evento = ultimoEvento(erroSpy);
    // LGPD: log é copiado e exportado; CPF não pode viajar nele.
    expect(evento.cpf).toBe('***00');
    expect(evento.paymentId).toBe('pay-1');
  });
});
