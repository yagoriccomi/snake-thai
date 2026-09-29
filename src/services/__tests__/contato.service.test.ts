import { NETWORK_FAILURE } from '@/test-utils/supabaseMock';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]): unknown => mockRpc(...args) },
}));

import { fetchContatoDaAcademia } from '@/services/contato.service';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('fetchContatoDaAcademia', () => {
  it('deveLerSoPelaRpcDoContrato', async () => {
    mockRpc.mockResolvedValue({ data: { whatsapp: '5511912345678', email: 'contato@exemplo.com' }, error: null });
    await expect(fetchContatoDaAcademia()).resolves.toEqual({
      whatsapp: '5511912345678',
      email: 'contato@exemplo.com',
    });
    expect(mockRpc).toHaveBeenCalledWith('contato_da_academia');
  });

  it('deveTratarCampoAusenteOuVazioComoNaoCadastrado', async () => {
    mockRpc.mockResolvedValue({ data: { whatsapp: null, email: '  ' }, error: null });
    await expect(fetchContatoDaAcademia()).resolves.toEqual({ whatsapp: null, email: null });
  });

  it('devePropagarAFalha', async () => {
    mockRpc.mockResolvedValue(NETWORK_FAILURE);
    await expect(fetchContatoDaAcademia()).rejects.toEqual(NETWORK_FAILURE.error);
  });
});
