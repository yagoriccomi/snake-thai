import { renderHook, waitFor } from '@testing-library/react-native';

const mockFetchStudents = jest.fn();
const mockFetchAttendance = jest.fn();

jest.mock('@/services/classes.service', () => ({
  fetchStudentsForGroup: (...args: unknown[]): unknown => mockFetchStudents(...args),
  fetchAttendanceForClass: (...args: unknown[]): unknown => mockFetchAttendance(...args),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { useClassAttendance } from '@/hooks/useClassAttendance';

const AULA = 'aula-1';
const TURMA = 'turma-manha';

const ATIVA = { id: 'aluna-ativa', name: 'Ana Souza', status: 'active' as const };
const TRANCADO = { id: 'aluno-trancado', name: 'Bruno Lima', status: 'inactive' as const };
const TRANCADA_COM_MARCA = { id: 'aluna-marcada', name: 'Carla Dias', status: 'inactive' as const };

beforeEach(() => {
  mockFetchStudents.mockReset();
  mockFetchAttendance.mockReset();
});

describe('useClassAttendance', () => {
  it('deveEsconderMatriculaTrancadaDaChamada', async () => {
    mockFetchStudents.mockResolvedValue([ATIVA, TRANCADO]);
    mockFetchAttendance.mockResolvedValue([]);

    const { result } = renderHook(() => useClassAttendance(AULA, TURMA));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.students.map((aluno) => aluno.id)).toEqual([ATIVA.id]);
  });

  it('deveManterOTrancadoQueJaFoiMarcadoNestaAula', async () => {
    // Trancou depois da chamada: o professor precisa ver o que registrou.
    mockFetchStudents.mockResolvedValue([ATIVA, TRANCADO, TRANCADA_COM_MARCA]);
    mockFetchAttendance.mockResolvedValue([
      { user_id: TRANCADA_COM_MARCA.id, status: 'present', declared_status: null },
    ]);

    const { result } = renderHook(() => useClassAttendance(AULA, TURMA));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.students.map((aluno) => aluno.id)).toEqual([ATIVA.id, TRANCADA_COM_MARCA.id]);
    expect(result.current.officialByStudent[TRANCADA_COM_MARCA.id]).toBe('present');
  });

  it('deveAvisarQuandoACargaFalhaEmVezDeMostrarListaVazia', async () => {
    mockFetchStudents.mockRejectedValue(new TypeError('Network request failed'));
    mockFetchAttendance.mockResolvedValue([]);

    const { result } = renderHook(() => useClassAttendance(AULA, TURMA));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Não foi possível carregar a lista de presença.');
    expect(result.current.students).toEqual([]);
  });
});
