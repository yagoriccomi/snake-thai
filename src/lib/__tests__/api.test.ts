/**
 * Cliente HTTP do backend próprio.
 *
 * A maior parte destes casos ataca FALHA, não sucesso: este cliente existe
 * justamente porque o servidor hiberna, a rede cai e o token expira. O caminho
 * feliz é o cenário menos interessante aqui. [Regra de Ouro nº 3][#47]
 */

/*
 * `jest.mock` é içado acima de qualquer `const`: uma variável declarada aqui
 * fora ainda não existe quando a factory roda. Por isso o objeto do mock é
 * criado DENTRO da factory e depois importado — é a mesma referência, e mutar
 * `env.apiUrl` num teste muda o que o módulo sob teste enxerga.
 */
jest.mock('@/config/env', () => ({
  env: { apiUrl: 'https://api.teste.invalid' },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));

import { env } from '@/config/env';
import { supabase } from '@/lib/supabase';
import { ApiError, ApiNaoConfiguradaError, apiDisponivel, chamarApi, preAquecer } from '@/lib/api';

/** O mock é mutável; o tipo real declara `readonly`. */
const mockEnv = env as { apiUrl: string | null };
const mockGetSession = supabase.auth.getSession as jest.Mock;

const TOKEN = 'jwt-de-teste-nao-e-segredo';

/** Resposta de sucesso do servidor. */
function respostaOk(corpo: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(corpo),
  } as unknown as Response;
}

/** Resposta de erro no formato `{ error, code }` que o servidor padroniza. */
function respostaErro(status: number, error: string, code: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error, code }),
  } as unknown as Response;
}

describe('api', () => {
  beforeEach(() => {
    mockEnv.apiUrl = 'https://api.teste.invalid';
    mockGetSession.mockResolvedValue({ data: { session: { access_token: TOKEN } } });
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('apiDisponivel', () => {
    it('deveIndicarIndisponivelQuandoOBuildNaoTemUrlDoBackend', () => {
      mockEnv.apiUrl = null;
      expect(apiDisponivel()).toBe(false);
    });

    it('deveIndicarDisponivelQuandoHaUrlConfigurada', () => {
      expect(apiDisponivel()).toBe(true);
    });
  });

  describe('chamarApi', () => {
    it('deveFalharComErroProprioQuandoOBackendNaoFoiConfigurado', async () => {
      // Sem esta checagem a URL viraria "null/v1/proofs/..." e o erro chegaria
      // ao usuário como falha de rede genérica, escondendo um problema de build.
      mockEnv.apiUrl = null;

      await expect(chamarApi('/v1/proofs/view-url', {})).rejects.toBeInstanceOf(
        ApiNaoConfiguradaError,
      );
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('deveFalharQuandoNaoHaSessaoEmVezDeChamarSemAutenticacao', async () => {
      // Uma chamada sem Authorization voltaria 401 do servidor depois de
      // atravessar a rede e possivelmente um cold start de 60 s.
      mockGetSession.mockResolvedValue({ data: { session: null } });

      await expect(chamarApi('/v1/proofs/view-url', {})).rejects.toMatchObject({
        code: 'no_session',
        status: 401,
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('deveEnviarOTokenDaSessaoNoCabecalhoDeAutorizacao', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue(respostaOk({ url: 'https://x' }));

      await chamarApi('/v1/proofs/view-url', { paymentId: 'p1' });

      const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    });

    it('naoDeveRepetirQuandoOServidorRespondeErroDeCliente', async () => {
      // ESTE É O CASO CRÍTICO. Repetir um 403 não muda o resultado, dobra a
      // espera do usuário e, num POST, pode duplicar efeito. O retry existe
      // para o servidor hibernando, não para a palavra final do servidor.
      (globalThis.fetch as jest.Mock).mockResolvedValue(
        respostaErro(403, 'Sem acesso', 'forbidden'),
      );

      await expect(chamarApi('/v1/proofs/view-url', {})).rejects.toMatchObject({
        status: 403,
        code: 'forbidden',
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('deveDevolverAMensagemEOCodigoQueOServidorPadronizou', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue(
        respostaErro(400, 'paymentId inválido', 'bad_input'),
      );

      await expect(chamarApi('/v1/proofs/sign-upload', {})).rejects.toMatchObject({
        message: 'paymentId inválido',
        code: 'bad_input',
      });
    });

    it('naoDeveVazarDetalheTecnicoQuandoOServidorNaoDevolveCorpoLegivel', async () => {
      // Um proxy no meio do caminho pode devolver HTML. O usuário recebe
      // mensagem tratada, nunca o corpo cru. [#93]
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('Unexpected token < in JSON')),
      } as unknown as Response);

      await expect(chamarApi('/v1/proofs/view-url', {})).rejects.toMatchObject({
        message: 'Não foi possível concluir a operação.',
        code: 'erro_desconhecido',
      });
    });

    it('deveRepetirUmaVezQuandoARedeFalhaPorqueOServidorPodeEstarAcordando', async () => {
      jest.useFakeTimers();
      (globalThis.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce(respostaOk({ url: 'https://x' }));

      const promessa = chamarApi<{ url: string }>('/v1/proofs/view-url', {});
      await jest.advanceTimersByTimeAsync(2_000);

      await expect(promessa).resolves.toEqual({ url: 'https://x' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('deveDesistirComMensagemUtilQuandoARedeFalhaNasDuasTentativas', async () => {
      // Falha em silêncio aqui deixaria a tela girando para sempre.
      jest.useFakeTimers();
      (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));

      const promessa = chamarApi('/v1/proofs/view-url', {});
      const capturado = promessa.catch((erro: unknown) => erro);
      await jest.advanceTimersByTimeAsync(2_000);

      const erro = await capturado;
      expect(erro).toBeInstanceOf(ApiError);
      expect(erro).toMatchObject({ status: 503, code: 'falha_de_rede' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('deveAbortarACHamadaQuandoOServidorPassaDoTempoLimite', async () => {
      // O timeout é longo de propósito (cold start), mas ele EXISTE: sem
      // AbortController a requisição penduraria indefinidamente.
      (globalThis.fetch as jest.Mock).mockImplementation((_url: string, init: RequestInit) => {
        const sinal = init.signal as AbortSignal;
        return new Promise((_resolver, rejeitar) => {
          sinal.addEventListener('abort', () => {
            rejeitar(new Error('Aborted'));
          });
        });
      });
      jest.useFakeTimers();

      const promessa = chamarApi('/v1/proofs/view-url', {});
      const capturado = promessa.catch((erro: unknown) => erro);
      // 65s do primeiro timeout + espera + 65s do segundo.
      await jest.advanceTimersByTimeAsync(140_000);

      await expect(capturado).resolves.toMatchObject({ code: 'falha_de_rede' });
    });
  });

  describe('preAquecer', () => {
    it('deveChamarOHealthParaAcordarOServidorAntesDoUsoReal', () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue(respostaOk({ ok: true }));

      preAquecer();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.teste.invalid/health',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('naoDeveTentarAcordarNadaQuandoNaoHaBackendConfigurado', () => {
      mockEnv.apiUrl = null;

      preAquecer();

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('naoDevePropagarErroPorqueOPreAquecimentoEhOtimizacaoENaoRequisito', async () => {
      // Se o pré-aquecimento estourasse, derrubaria a tela ANTES de o usuário
      // sequer tentar a operação real — que ainda poderia dar certo.
      (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));

      expect(() => {
        preAquecer();
      }).not.toThrow();
      await Promise.resolve();
    });

    it('naoDeveExigirSessaoParaAcordarOServidor', () => {
      // `/health` não é autenticado. Exigir token aqui impediria o
      // pré-aquecimento justamente na tela de quem ainda está entrando.
      mockGetSession.mockResolvedValue({ data: { session: null } });
      (globalThis.fetch as jest.Mock).mockResolvedValue(respostaOk({ ok: true }));

      preAquecer();

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
