import { RLS_DENIED } from '@/test-utils/supabaseMock';

const mockDelete = jest.fn();
const mockIn = jest.fn();
const mockUpsert = jest.fn();
const mockSelect = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]): unknown => mockSelect(...args),
      upsert: (...args: unknown[]): unknown => mockUpsert(...args),
      delete: () => {
        mockDelete();
        return { in: (...args: unknown[]): unknown => mockIn(...args) };
      },
    }),
    rpc: (...args: unknown[]): unknown => mockRpc(...args),
  },
}));

import {
  fetchLegalFieldValues,
  previewLegalDocument,
  saveLegalFieldValues,
} from '@/services/legalFields.service';
import { describeError } from '@/utils/errors';

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
  mockIn.mockResolvedValue({ error: null });
});

describe('fetchLegalFieldValues', () => {
  it('deveDevolverOsValoresPorChave', async () => {
    mockSelect.mockResolvedValue({
      data: [
        { id: 'cnpj', value: '12.345.678/0001-90' },
        { id: 'foro', value: 'São Paulo/SP' },
      ],
      error: null,
    });

    await expect(fetchLegalFieldValues()).resolves.toEqual({
      cnpj: '12.345.678/0001-90',
      foro: 'São Paulo/SP',
    });
  });

  it('devePropagarARecusaParaQuemNaoEAdmin', async () => {
    mockSelect.mockResolvedValue(RLS_DENIED);
    await expect(fetchLegalFieldValues()).rejects.toEqual(RLS_DENIED.error);
  });
});

describe('saveLegalFieldValues', () => {
  it('deveGravarOPreenchidoEApagarOEsvaziado', async () => {
    // Campo esvaziado tem de sumir: gravado como '' o banco acharia que está
    // pronto e deixaria publicar um texto com a lacuna.
    await saveLegalFieldValues({ cnpj: ' 12.345.678/0001-90 ', foro: '   ', razao_social: 'Academia Ltda' });

    expect(mockIn).toHaveBeenCalledWith('id', ['foro']);
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        { id: 'cnpj', value: '12.345.678/0001-90' },
        { id: 'razao_social', value: 'Academia Ltda' },
      ],
      { onConflict: 'id' },
    );
  });

  it('naoDeveChamarOBancoQuandoNaoHaNadaParaApagar', async () => {
    await saveLegalFieldValues({ cnpj: '123' });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deveMostrarAMensagemDoBancoQuandoOValorTemMarcador', async () => {
    mockUpsert.mockResolvedValue({
      error: { code: '23514', message: 'O valor não pode conter marcador.', details: null },
    });
    const falha = await saveLegalFieldValues({ cnpj: '{{cnpj}}' }).catch((erro: unknown) => erro);
    expect(describeError(falha)).toBe('O valor não pode conter marcador.');
  });
});

describe('previewLegalDocument', () => {
  it('deveDevolverOTextoEAsChavesQueFaltam', async () => {
    mockRpc.mockResolvedValue({
      data: [{ conteudo: '# Termos\n\nAcademia Ltda, CNPJ {{cnpj}}.', faltando: ['cnpj'] }],
      error: null,
    });

    const previa = await previewLegalDocument('terms_of_use');

    expect(mockRpc).toHaveBeenCalledWith('renderizar_documento_legal', { p_tipo: 'terms_of_use' });
    expect(previa.faltando).toEqual(['cnpj']);
    expect(previa.conteudo).toContain('{{cnpj}}');
  });

  it('deveFalharAltoQuandoARespostaNaoTemTexto', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await expect(previewLegalDocument('privacy_policy')).rejects.toThrow('renderizar_documento_legal');
  });
});
