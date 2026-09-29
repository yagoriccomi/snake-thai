import { NETWORK_FAILURE } from '@/test-utils/supabaseMock';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]): unknown => mockRpc(...args) },
}));

import {
  criarMotivoDeRetificacao,
  fetchChamadasPendentes,
  fetchListaDaChamada,
  salvarChamada,
} from '@/services/chamada.service';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('chamada.service (contrato § 7.2)', () => {
  it('deveTraduzirALista', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          user_id: 'a-1', name: 'Ana', schedule_mode: 'fixed', weekly_target: null, origem: 'troca_pendente',
          declared_status: null, status: null, edited: false, previous_status: null, edited_by_name: null,
          edited_at: null, taken_by_name: null, justification_id: null, justification_status: null,
          week_attended: null, week_expected: null, swap_id: 's-1', swap_kind: 'once', swap_status: 'pending',
          swap_role: 'destino', swap_other_date_time: '2030-03-14T22:00:00Z',
        },
      ],
      error: null,
    });
    const [aluno] = await fetchListaDaChamada('c-1');
    expect(mockRpc).toHaveBeenCalledWith('lista_da_chamada', { p_class_id: 'c-1' });
    expect(aluno).toMatchObject({ origem: 'troca_pendente', swapRole: 'destino', swapStatus: 'pending' });
  });

  it('deveSalvarComOsSeteParametrosEOMotivo', async () => {
    mockRpc.mockResolvedValue({ data: { concluida_em: '2030-03-10T23:00:00Z', retificada: true, alteracoes: 2 }, error: null });
    const resultado = await salvarChamada('c-1', {
      presentes: ['a'],
      ausentes: ['b'],
      professoresPresentes: ['p'],
      professoresAusentes: [],
      removerIncluidos: [],
      motivoId: 'm-1',
    });
    expect(mockRpc).toHaveBeenCalledWith('salvar_chamada_v2', {
      p_class_id: 'c-1',
      p_presentes: ['a'],
      p_ausentes: ['b'],
      p_professores_presentes: ['p'],
      p_professores_ausentes: [],
      p_remover_incluidos: [],
      p_motivo_id: 'm-1',
    });
    expect(resultado).toEqual({ concluidaEm: '2030-03-10T23:00:00Z', retificada: true, alteracoes: 2 });
  });

  it('deveMostrarAFraseDoBancoNaRecusa', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Para retificar, informe o motivo.' } });
    await expect(
      salvarChamada('c-1', {
        presentes: [],
        ausentes: [],
        professoresPresentes: [],
        professoresAusentes: [],
        removerIncluidos: [],
        motivoId: null,
      }),
    ).rejects.toMatchObject({ message: 'Para retificar, informe o motivo.' });
    // Sem motivo, o parâmetro nem vai: o banco usa o padrão.
    expect(mockRpc.mock.calls[0]?.[1]).not.toHaveProperty('p_motivo_id');
  });

  it('deveCriarOMotivoDeRetificacao', async () => {
    mockRpc.mockResolvedValue({ data: 'm-9', error: null });
    await expect(criarMotivoDeRetificacao('c-1', 'Marquei errado')).resolves.toBe('m-9');
    expect(mockRpc).toHaveBeenCalledWith('criar_motivo', { p_kind: 'roll_call_edit', p_class_id: 'c-1', p_texto: 'Marquei errado' });
  });

  it('deveLerAsPendentesEPropagarAFalhaDeRede', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await fetchChamadasPendentes(false);
    expect(mockRpc).toHaveBeenCalledWith('chamadas_pendentes', { p_somente_minhas: false });
    mockRpc.mockResolvedValue(NETWORK_FAILURE);
    await expect(fetchChamadasPendentes(true)).rejects.toEqual(NETWORK_FAILURE.error);
  });
});
