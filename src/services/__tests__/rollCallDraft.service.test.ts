const mockArmazenamento = new Map<string, string>();

jest.mock('@/lib/secureStorage', () => ({
  largeSecureStore: {
    getItem: jest.fn(async (chave: string) => mockArmazenamento.get(chave) ?? null),
    setItem: jest.fn(async (chave: string, valor: string) => {
      mockArmazenamento.set(chave, valor);
    }),
    removeItem: jest.fn(async (chave: string) => {
      mockArmazenamento.delete(chave);
    }),
    listKeys: jest.fn(async (prefixo: string) =>
      [...mockArmazenamento.keys()].filter((chave) => chave.startsWith(prefixo)),
    ),
  },
}));

import {
  apagarRascunho,
  apagarRascunhosDoAparelho,
  apagarRascunhosVencidos,
  guardarRascunho,
  lerRascunho,
} from '@/services/rollCallDraft.service';
import {
  chaveDoRascunho,
  VALIDADE_DO_RASCUNHO_MS,
  VERSAO_DO_RASCUNHO,
  type RascunhoGuardado,
} from '@/utils/rollCallDraft';

const AGORA = Date.parse('2026-09-16T12:00:00.000Z');
const PROFESSOR = 'prof-1';

function registro(classId: string, salvoEmMs = AGORA): RascunhoGuardado {
  return {
    versao: VERSAO_DO_RASCUNHO,
    classId,
    salvoEm: new Date(salvoEmMs).toISOString(),
    base: { marcacoes: {}, concluidaEm: null },
    marcacoes: { 'aluno-1': 'present' },
  };
}

beforeEach(() => {
  mockArmazenamento.clear();
});

describe('rollCallDraft.service', () => {
  it('deveLerOMesmoRegistroQueGuardou', async () => {
    await guardarRascunho(PROFESSOR, registro('aula-1'));

    expect(await lerRascunho(PROFESSOR, 'aula-1')).toEqual(registro('aula-1'));
    expect(await lerRascunho('outro-prof', 'aula-1')).toBeNull();
  });

  it('deveApagarRegistroCorrompidoEDevolverNulo', async () => {
    mockArmazenamento.set(chaveDoRascunho(PROFESSOR, 'aula-1'), '{"versao":99}');

    expect(await lerRascunho(PROFESSOR, 'aula-1')).toBeNull();
    expect(mockArmazenamento.size).toBe(0);
  });

  it('deveApagarRegistroDeOutraAulaGuardadoNaChaveErrada', async () => {
    mockArmazenamento.set(chaveDoRascunho(PROFESSOR, 'aula-1'), JSON.stringify(registro('aula-2')));

    expect(await lerRascunho(PROFESSOR, 'aula-1')).toBeNull();
    expect(mockArmazenamento.size).toBe(0);
  });

  it('apagarRascunhoDeveTirarSoAquelaAula', async () => {
    await guardarRascunho(PROFESSOR, registro('aula-1'));
    await guardarRascunho(PROFESSOR, registro('aula-2'));

    await apagarRascunho(PROFESSOR, 'aula-1');

    expect(await lerRascunho(PROFESSOR, 'aula-1')).toBeNull();
    expect(await lerRascunho(PROFESSOR, 'aula-2')).not.toBeNull();
  });

  it('apagarRascunhosDoAparelhoNaoDeveTocarNaSessao', async () => {
    mockArmazenamento.set('sb-projeto-auth-token', '{"access_token":"x"}');
    await guardarRascunho(PROFESSOR, registro('aula-1'));
    await guardarRascunho('prof-2', registro('aula-2'));

    await apagarRascunhosDoAparelho();

    expect([...mockArmazenamento.keys()]).toEqual(['sb-projeto-auth-token']);
  });

  it('apagarRascunhosVencidosDeveTirarSoOsVencidosEOsIlegiveis', async () => {
    await guardarRascunho(PROFESSOR, registro('aula-recente'));
    await guardarRascunho(PROFESSOR, registro('aula-velha', AGORA - VALIDADE_DO_RASCUNHO_MS - 1));
    mockArmazenamento.set(chaveDoRascunho(PROFESSOR, 'aula-quebrada'), 'lixo');

    const apagados = await apagarRascunhosVencidos(AGORA);

    expect(apagados).toBe(2);
    expect([...mockArmazenamento.keys()]).toEqual([chaveDoRascunho(PROFESSOR, 'aula-recente')]);
  });
});
