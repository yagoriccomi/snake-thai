jest.mock('@/lib/monitoring/installId', () => ({
  obterIdDeInstalacao: jest.fn().mockResolvedValue('instalacao-1'),
}));

import * as Sentry from '@sentry/react-native';

import { createLogger } from '@/lib/logger';
import {
  _reiniciarMonitoramento,
  clearMonitoringUser,
  initMonitoring,
  reportError,
  setMonitoringUser,
  wrapRoot,
} from '@/lib/monitoring';

type MockDoSentry = Record<
  'init' | 'captureException' | 'captureMessage' | 'setUser' | 'setTag' | 'withScope' | 'wrap',
  jest.Mock
> & {
  __escopo: Record<'setTag' | 'setExtras' | 'setFingerprint', jest.Mock>;
};

const sentry = Sentry as unknown as MockDoSentry;

const LIGADO = { dsn: 'https://chave@o0.ingest.de.sentry.io/1', ambiente: 'development', modoDebug: false } as const;

beforeEach(() => {
  _reiniciarMonitoramento();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('initMonitoring', () => {
  it('naoDeveInicializarSemDsn', () => {
    expect(initMonitoring({ ...LIGADO, dsn: null })).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('naoDeveInicializarNoMetroEmModoDebug', () => {
    expect(initMonitoring({ ...LIGADO, modoDebug: true })).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('deveUsarEnvironmentDaVarianteESemDadoPessoal', () => {
    expect(initMonitoring(LIGADO)).toBe(true);

    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'development',
        sendDefaultPii: false,
        attachScreenshot: false,
        attachViewHierarchy: false,
      }),
    );
  });

  it('beforeSendDeveDescartarFalhaDeRedeEFiltrarOResto', () => {
    initMonitoring(LIGADO);
    const { beforeSend } = sentry.init.mock.calls[0]?.[0] as {
      beforeSend: (evento: object, dica: object) => object | null;
    };

    expect(beforeSend({ message: 'x' }, { originalException: new TypeError('Network request failed') })).toBeNull();
    expect(beforeSend({ message: 'cpf 123.456.789-00', user: { id: 'i', email: 'a@b.com' } }, {})).toEqual({
      message: 'cpf [removido]',
      user: { id: 'i' },
    });
  });

  it('deveLigarOLoggerAoSentry', () => {
    initMonitoring(LIGADO);
    const erro = new Error('quebrou');

    createLogger('PagamentoScreen').error('Falha ao enviar', erro);

    expect(sentry.captureException).toHaveBeenCalledWith(erro);
    expect(sentry.__escopo.setTag).toHaveBeenCalledWith('scope', 'PagamentoScreen');
  });
});

describe('reportError', () => {
  it('reportErrorComErrorDeveChamarCaptureExceptionComScope', () => {
    initMonitoring(LIGADO);
    const erro = new Error('x');

    reportError({ scope: 'useAdminPayments', message: 'Falha ao carregar', error: erro, context: { mes: '2026-09' } });

    expect(sentry.captureException).toHaveBeenCalledWith(erro);
    expect(sentry.__escopo.setFingerprint).toHaveBeenCalledWith(['useAdminPayments', 'Falha ao carregar']);
    expect(sentry.__escopo.setExtras).toHaveBeenCalledWith({ mes: '2026-09', mensagem: 'Falha ao carregar' });
  });

  it('reportErrorComObjetoDeveChamarCaptureMessageSemPii', () => {
    initMonitoring(LIGADO);

    reportError({
      scope: 'profile.service',
      message: 'Falha ao salvar e-mail fulano@exemplo.com',
      error: { code: '23505' },
      context: { errorMessage: '{"code":"23505","details":"[removido]"}' },
    });

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(sentry.captureMessage).toHaveBeenCalledWith('profile.service: Falha ao salvar e-mail [removido]', 'error');
  });

  it('naoDeveEnviarNadaComOMonitoramentoDesligado', () => {
    reportError({ scope: 'x', message: 'y', error: new Error('z') });
    expect(sentry.withScope).not.toHaveBeenCalled();
  });

  it('falhaDoSdkNaoDevePropagar', () => {
    initMonitoring(LIGADO);
    sentry.withScope.mockImplementationOnce(() => {
      throw new Error('SDK quebrado');
    });

    expect(() => reportError({ scope: 'x', message: 'y', error: new Error('z') })).not.toThrow();
  });
});

describe('usuário e raiz', () => {
  it('deveDefinirUsuarioSoComIdDeInstalacaoEPapel', async () => {
    initMonitoring(LIGADO);

    await setMonitoringUser('professor');

    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'instalacao-1' });
    expect(sentry.setTag).toHaveBeenCalledWith('role', 'professor');
  });

  it('deveLimparUsuarioAoSair', () => {
    initMonitoring(LIGADO);

    clearMonitoringUser();

    expect(sentry.setUser).toHaveBeenCalledWith(null);
  });

  it('wrapRootNaoDeveEnvolverComOMonitoramentoDesligado', () => {
    const Raiz = (): null => null;
    expect(wrapRoot(Raiz)).toBe(Raiz);
    expect(sentry.wrap).not.toHaveBeenCalled();
  });
});
