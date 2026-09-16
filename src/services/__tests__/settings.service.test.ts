import { RLS_DENIED } from '@/test-utils/supabaseMock';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]): unknown => mockRpc(...args),
  },
}));

import {
  countAccountsWithoutFirstAccess,
  fetchDefaultStudentPassword,
  updateDefaultStudentPassword,
} from '@/services/settings.service';
import { describeError } from '@/utils/errors';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('senha de primeiro acesso', () => {
  it('deveLerPelaFuncaoProtegida', async () => {
    mockRpc.mockResolvedValue({ data: 'SenhaDoBalcao#1', error: null });

    await expect(fetchDefaultStudentPassword()).resolves.toBe('SenhaDoBalcao#1');
    expect(mockRpc).toHaveBeenCalledWith('senha_padrao_da_academia');
  });

  it('devePropagarARecusaParaQuemNaoEAdmin', async () => {
    mockRpc.mockResolvedValue(RLS_DENIED);
    await expect(fetchDefaultStudentPassword()).rejects.toEqual(RLS_DENIED.error);
  });

  it('deveTrocarEMostrarAMensagemDoBancoQuandoCurta', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await updateDefaultStudentPassword('NovaSenha#2026');
    expect(mockRpc).toHaveBeenCalledWith('definir_senha_padrao_da_academia', { p_senha: 'NovaSenha#2026' });

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23514', message: 'A senha de primeiro acesso precisa de ao menos 8 caracteres.', details: null },
    });
    const falha = await updateDefaultStudentPassword('curta').catch((erro: unknown) => erro);
    expect(describeError(falha)).toBe('A senha de primeiro acesso precisa de ao menos 8 caracteres.');
  });

  it('deveContarAsContasSemPrimeiroAcesso', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null });
    await expect(countAccountsWithoutFirstAccess()).resolves.toBe(3);
    expect(mockRpc).toHaveBeenCalledWith('contas_sem_primeiro_acesso');
  });
});
