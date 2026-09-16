import { RLS_DENIED } from '@/test-utils/supabaseMock';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]): unknown => mockRpc(...args),
  },
}));

import {
  acceptLegalDocuments,
  fetchCurrentLegalDocuments,
  fetchPendingLegalDocuments,
} from '@/services/legalDocuments.service';
import { describeError } from '@/utils/errors';

const POLITICA = {
  id: '0d7f3a4e-7a51-4f57-9d0c-1c2b3a4d5e6f',
  tipo: 'privacy_policy',
  versao: '1.0',
  publicado_em: '2026-09-16T15:00:00Z',
};
const TERMOS = {
  id: '5a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  tipo: 'terms_of_use',
  versao: '1.0',
  publicado_em: '2026-09-16T15:00:00Z',
};

beforeEach(() => {
  mockRpc.mockReset();
});

describe('fetchPendingLegalDocuments', () => {
  it('deveListarOsPendentesComAPoliticaPrimeiro', async () => {
    mockRpc.mockResolvedValue({ data: [TERMOS, POLITICA], error: null });

    const pendentes = await fetchPendingLegalDocuments();

    expect(mockRpc).toHaveBeenCalledWith('documentos_legais_pendentes');
    expect(pendentes).toEqual([
      { id: POLITICA.id, tipo: 'privacy_policy', versao: '1.0', publicadoEm: POLITICA.publicado_em },
      { id: TERMOS.id, tipo: 'terms_of_use', versao: '1.0', publicadoEm: TERMOS.publicado_em },
    ]);
  });

  it('deveFalharAltoComTipoDesconhecido', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...POLITICA, tipo: 'cookies' }], error: null });
    await expect(fetchPendingLegalDocuments()).rejects.toThrow('documentos_legais_pendentes.tipo');
  });

  it('devePropagarErroDoBanco', async () => {
    mockRpc.mockResolvedValue(RLS_DENIED);
    await expect(fetchPendingLegalDocuments()).rejects.toEqual(RLS_DENIED.error);
  });
});

describe('fetchCurrentLegalDocuments', () => {
  it('deveTrazerTextoEDataDoAceiteNulaQuandoNaoAceitou', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { ...TERMOS, conteudo: '# Termos', aceito_em: '2026-09-17T10:00:00Z' },
        { ...POLITICA, conteudo: '# Política', aceito_em: null },
      ],
      error: null,
    });

    const vigentes = await fetchCurrentLegalDocuments();

    expect(mockRpc).toHaveBeenCalledWith('documentos_legais_vigentes');
    expect(vigentes.map((documento) => [documento.tipo, documento.conteudo, documento.aceitoEm])).toEqual([
      ['privacy_policy', '# Política', null],
      ['terms_of_use', '# Termos', '2026-09-17T10:00:00Z'],
    ]);
  });

  it('deveDevolverListaVaziaSemPublicacao', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await expect(fetchCurrentLegalDocuments()).resolves.toEqual([]);
  });
});

describe('acceptLegalDocuments', () => {
  it('deveMandarOsIdsParaAFuncaoDoBanco', async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null });
    await acceptLegalDocuments([POLITICA.id, TERMOS.id]);
    expect(mockRpc).toHaveBeenCalledWith('aceitar_documentos_legais', { p_documentos: [POLITICA.id, TERMOS.id] });
  });

  it('deveMostrarAMensagemDoBancoQuandoAVersaoMudou', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'Os documentos foram atualizados. Leia a versão nova antes de aceitar.', details: null },
    });
    const falha = await acceptLegalDocuments([POLITICA.id]).catch((erro: unknown) => erro);
    expect(describeError(falha)).toBe('Os documentos foram atualizados. Leia a versão nova antes de aceitar.');
  });
});
