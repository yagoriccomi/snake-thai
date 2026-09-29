import { NETWORK_FAILURE } from '@/test-utils/supabaseMock';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]): unknown => mockRpc(...args) },
}));

import { declararAula, definirMetaSemanal, fetchAulasDoAluno, fetchMenuDeAulas } from '@/services/aulas.service';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('aulas.service (contrato § 9.2, § 12, § 12.2, § 5.3)', () => {
  it('deveLerAsAulasDoAlunoPeloPeriodoEConverterOsProfessores', async () => {
    mockRpc.mockResolvedValue({
      data: [{ class_id: 'a-1', teachers: [{ id: 'p-1', name: 'Ana', color: '#F472B6' }] }, { class_id: 'a-2', teachers: null }],
      error: null,
    });
    const de = new Date('2030-03-11T03:00:00.000Z');
    const ate = new Date('2030-03-25T03:00:00.000Z');

    const aulas = await fetchAulasDoAluno(de, ate);

    expect(mockRpc).toHaveBeenCalledWith('aulas_do_aluno', { p_de: de.toISOString(), p_ate: ate.toISOString() });
    expect(aulas[0]?.teachers).toEqual([{ id: 'p-1', name: 'Ana', color: '#F472B6' }]);
    expect(aulas[1]?.teachers).toEqual([]);
  });

  it('deveLerOMenuPelaSemana', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await fetchMenuDeAulas('2030-03-13');
    expect(mockRpc).toHaveBeenCalledWith('menu_de_aulas', { p_semana: '2030-03-13' });
  });

  it('deveDevolverOAvisoDeCotaDoBanco', async () => {
    mockRpc.mockResolvedValue({ data: { marcadas_na_semana: 4, cota: 3, acima_da_cota: true }, error: null });
    await expect(declararAula('a-1', true)).resolves.toEqual({ marcadasNaSemana: 4, cota: 3, acimaDaCota: true });
    expect(mockRpc).toHaveBeenCalledWith('declarar_aula', { p_class_id: 'a-1', p_vou: true });
  });

  it('deveMostrarAFraseDoBancoQuandoADeclaracaoERecusada', async () => {
    const frase = 'Você já tem aula neste horário. Para ir nesta, peça a troca.';
    mockRpc.mockResolvedValue({ data: null, error: { message: frase, code: '23514' } });
    await expect(declararAula('a-1', true)).rejects.toMatchObject({ message: frase });
  });

  it('deveDefinirAMetaEDevolverAPartirDeQuandoVale', async () => {
    mockRpc.mockResolvedValue({ data: { meta: 5, vale_a_partir: '2030-03-18' }, error: null });
    await expect(definirMetaSemanal(5)).resolves.toEqual({ meta: 5, valeAPartir: '2030-03-18' });
    expect(mockRpc).toHaveBeenCalledWith('definir_meta_semanal', { p_meta: 5 });
  });

  it('devePropagarAFalhaDeRede', async () => {
    mockRpc.mockResolvedValue(NETWORK_FAILURE);
    await expect(fetchMenuDeAulas('2030-03-13')).rejects.toEqual(NETWORK_FAILURE.error);
  });
});
