const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]): unknown => mockRpc(...args) },
}));

import { decidirTroca, desistirDaTroca, fetchTrocasParaDecidir, pedirTroca } from '@/services/trocas.service';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('trocas.service (§ 9.4)', () => {
  it('devePedirAAvulsaSemMotivo', async () => {
    mockRpc.mockResolvedValue({ data: 't-1', error: null });
    await expect(pedirTroca('a', 'b', 'once', null)).resolves.toBe('t-1');
    expect(mockRpc.mock.calls).toEqual([['pedir_troca_de_aula', { p_de: 'a', p_para: 'b', p_tipo: 'once', p_motivo_id: undefined }]]);
  });

  it('deveCriarOMotivoAntesDaPermanente', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'm-1', error: null }).mockResolvedValueOnce({ data: 't-2', error: null });
    await pedirTroca('a', 'b', 'permanent', ' Mudei de emprego ');
    expect(mockRpc.mock.calls).toEqual([
      ['criar_motivo', { p_kind: 'class_swap_evidence', p_class_id: null, p_texto: 'Mudei de emprego' }],
      ['pedir_troca_de_aula', { p_de: 'a', p_para: 'b', p_tipo: 'permanent', p_motivo_id: 'm-1' }],
    ]);
  });

  it('deveMostrarARecusaDoBanco', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '23514', message: 'Esta aula já é sua.' } });
    await expect(pedirTroca('a', 'b', 'once', null)).rejects.toMatchObject({ message: 'Esta aula já é sua.' });
  });

  it('deveMandarANotaSoQuandoHouver', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await decidirTroca('t-1', 'approved', '  ');
    expect(mockRpc).toHaveBeenLastCalledWith('decidir_troca_de_aula', { p_id: 't-1', p_decisao: 'approved', p_nota: undefined });
    await decidirTroca('t-1', 'rejected', ' Turma cheia ');
    expect(mockRpc).toHaveBeenLastCalledWith('decidir_troca_de_aula', { p_id: 't-1', p_decisao: 'rejected', p_nota: 'Turma cheia' });
  });

  it('deveDesistir', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await desistirDaTroca('t-1');
    expect(mockRpc).toHaveBeenCalledWith('desistir_da_troca', { p_id: 't-1' });
  });

  it('deveContarOsAnexos', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 't-1', kind: 'permanent', anexos: [{ id: 'x' }, { id: 'y' }], is_makeup: false }],
      error: null,
    });
    const [linha] = await fetchTrocasParaDecidir();
    expect(linha?.anexos).toBe(2);
  });
});
