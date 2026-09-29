const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]): unknown => mockRpc(...args) },
}));

import { fetchPreviaDosAvisos, mudarSituacaoDaAula } from '@/services/cancelamento.service';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('cancelamento.service (§ 6.1)', () => {
  it('deveCriarOMotivoECancelar', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'm-1', error: null }).mockResolvedValueOnce({ data: null, error: null });
    await mudarSituacaoDaAula('c-1', 'cancelar', 'Chuva');
    expect(mockRpc.mock.calls).toEqual([
      ['criar_motivo', { p_kind: 'class_cancel', p_class_id: 'c-1', p_texto: 'Chuva' }],
      ['cancelar_aula', { p_class_id: 'c-1', p_motivo_id: 'm-1' }],
    ]);
  });

  it('deveReativarComOMotivoCerto', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'm-2', error: null }).mockResolvedValueOnce({ data: null, error: null });
    await mudarSituacaoDaAula('c-1', 'reativar', 'Voltou');
    expect(mockRpc.mock.calls[0]?.[1]).toMatchObject({ p_kind: 'class_reactivate' });
    expect(mockRpc.mock.calls[1]?.[0]).toBe('reativar_aula');
  });

  it('devePararSeOMotivoForRecusado', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'Escreva o motivo, com até 500 caracteres.' } });
    await expect(mudarSituacaoDaAula('c-1', 'cancelar', '')).rejects.toMatchObject({
      message: 'Escreva o motivo, com até 500 caracteres.',
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('deveTraduzirAPrevia', async () => {
    mockRpc.mockResolvedValue({
      data: [{ antes_da_aula: true, fixos: 3, livres: 5, alunos_evento: 0, professores: ['Ana'], admins: 1 }],
      error: null,
    });
    await expect(fetchPreviaDosAvisos('c-1')).resolves.toEqual({
      antesDaAula: true, fixos: 3, livres: 5, alunosDoEvento: 0, professores: ['Ana'], admins: 1,
    });
  });
});
