jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  TEMPO_MAXIMO_DA_CONSULTA_MS,
  buscarUltimaRelease,
  gravarMemoriaDoAviso,
  lerMemoriaDoAviso,
} from '@/services/avisoDeAtualizacao.service';

const URL_ESPERADA = 'https://api.github.com/repos/yagoriccomi/snake-thai/releases/latest';

function resposta(status: number, corpo?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn(async () => {
      if (corpo === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return corpo;
    }),
  } as unknown as Response;
}

describe('buscarUltimaRelease', () => {
  it('deveConsultarAReleaseMaisRecenteSemTokenEComOAcceptDoGithub', async () => {
    const buscar = jest.fn(async () => resposta(200, { tag_name: 'v2.0.0', assets: [] }));

    const resultado = await buscarUltimaRelease(buscar);

    expect(resultado).toEqual({ tipo: 'release', release: { tag_name: 'v2.0.0', assets: [] } });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_ESPERADA);
    expect(init.headers).toEqual({ Accept: 'application/vnd.github+json' });
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization/i);
  });

  it.each([[403], [429]])('deveTratarOStatus %p comoLimiteQueContaODia', async (status) => {
    const resultado = await buscarUltimaRelease(jest.fn(async () => resposta(status)));
    expect(resultado).toEqual({ tipo: 'limite', status });
  });

  it('deveTratarOutroStatusComoFalhaQueNaoContaODia', async () => {
    const resultado = await buscarUltimaRelease(jest.fn(async () => resposta(500)));
    expect(resultado).toMatchObject({ tipo: 'falha', motivo: 'status 500' });
  });

  it('deveTratarSemRedeComoFalhaSemLancar', async () => {
    const resultado = await buscarUltimaRelease(
      jest.fn(async () => {
        throw new TypeError('Network request failed');
      }),
    );
    expect(resultado).toMatchObject({ tipo: 'falha', motivo: 'sem rede ou resposta inválida' });
  });

  it('deveAbortarDepoisDoTempoMaximo', async () => {
    jest.useFakeTimers();
    try {
      const buscar = jest.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, rejeitar) => {
            init.signal?.addEventListener('abort', () => rejeitar(new Error('Aborted')));
          }),
      );
      const consulta = buscarUltimaRelease(buscar, 5_000);
      jest.advanceTimersByTime(5_000);

      await expect(consulta).resolves.toMatchObject({ tipo: 'falha', motivo: 'tempo esgotado' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('deveUsarOLimiteDeCincoSegundosDoContrato', () => {
    expect(TEMPO_MAXIMO_DA_CONSULTA_MS).toBe(5_000);
  });

  it('deveTratarCorpoInvalidoComoFalha', async () => {
    expect(await buscarUltimaRelease(jest.fn(async () => resposta(200)))).toMatchObject({ tipo: 'falha' });
    expect(await buscarUltimaRelease(jest.fn(async () => resposta(200, null)))).toMatchObject({
      tipo: 'falha',
      motivo: 'resposta sem objeto',
    });
  });
});

describe('memória do aviso', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('deveVoltarNuloNaPrimeiraVez', async () => {
    expect(await lerMemoriaDoAviso()).toBeNull();
  });

  it('deveLembrarODiaEAUltimaTag', async () => {
    await gravarMemoriaDoAviso({ dia: '2026-09-25', ultimaTag: 'v1.9.0' });
    expect(await lerMemoriaDoAviso()).toEqual({ dia: '2026-09-25', ultimaTag: 'v1.9.0' });
  });

  it('deveTratarValorCorrompidoComoNuncaConsultado', async () => {
    await AsyncStorage.setItem('snakethai.aviso_de_atualizacao', '{quebrado');
    expect(await lerMemoriaDoAviso()).toBeNull();
    await AsyncStorage.setItem('snakethai.aviso_de_atualizacao', JSON.stringify({ ultimaTag: 'v1.9.0' }));
    expect(await lerMemoriaDoAviso()).toBeNull();
  });
});
