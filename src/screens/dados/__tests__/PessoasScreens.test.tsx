import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchPessoas = jest.fn();
const mockUpdateGroup = jest.fn();
const mockUpdatePlan = jest.fn();
const mockUpdateRole = jest.fn();
const mockPerfilAluno = jest.fn();
const mockHistoricoAluno = jest.fn();
const mockPerfilProfessor = jest.fn();
const mockHistoricoProfessor = jest.fn();

jest.mock('@/services/profile.service', () => ({
  fetchPessoas: (...args: unknown[]): unknown => mockFetchPessoas(...args),
  resetStudentPassword: jest.fn(),
  setStudentActive: jest.fn(),
  updateStudentGroup: (...args: unknown[]): unknown => mockUpdateGroup(...args),
  updateStudentPlan: (...args: unknown[]): unknown => mockUpdatePlan(...args),
  updateUserRole: (...args: unknown[]): unknown => mockUpdateRole(...args),
}));
jest.mock('@/services/perfis.service', () => ({
  fetchPerfilDoAluno: (...args: unknown[]): unknown => mockPerfilAluno(...args),
  fetchHistoricoDoAluno: (...args: unknown[]): unknown => mockHistoricoAluno(...args),
  fetchPerfilDoProfessor: (...args: unknown[]): unknown => mockPerfilProfessor(...args),
  fetchHistoricoDoProfessor: (...args: unknown[]): unknown => mockHistoricoProfessor(...args),
}));
jest.mock('@/services/plans.service', () => ({
  SCHEDULE_MODE_LABELS: { fixed: 'Horário fixo', free: 'Horário livre', unlimited: 'À vontade' },
}));
jest.mock('@/hooks/useGroups', () => ({
  useGroups: () => ({ groups: [{ id: 'g1', name: 'Turma Tarde' }, { id: 'g2', name: 'Turma Manhã' }], loading: false, error: null, reload: jest.fn() }),
}));
jest.mock('@/hooks/usePlans', () => ({ usePlans: () => ({ plans: [{ id: 'p1', name: 'Mensal 2x' }], loading: false, error: null }) }));
jest.mock('@/hooks/useDefaultStudentPassword', () => ({ useDefaultStudentPassword: () => ({ password: null }) }));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ profile: { id: 'eu' }, isAdmin: true }) }));
jest.mock('@/components/GroupPicker', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GroupPicker: ({ onChange }: { onChange: (id: string | null) => void }) => (
      <Pressable onPress={() => onChange('g2')}>
        <Text>escolher Turma Manhã</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/components/PlanPicker', () => ({ PlanPicker: () => null }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (efeito: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(efeito, []),
  useNavigation: () => ({ getParent: () => ({ navigate: mockNavigateParent }) }),
}));
const mockNavigateParent = jest.fn();
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import { PortalProvider } from '@/components/Portal';
import { FichaProfessorScreen } from '@/screens/dados/FichaProfessorScreen';
import { PessoasScreen } from '@/screens/dados/PessoasScreen';
import { FichaAlunoScreen } from '@/screens/FichaAlunoScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function comProvedores(tela: React.JSX.Element) {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <PortalProvider>{tela}</PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

const PESSOAS = [
  { id: 'a', role: 'user', name: 'Ana Beatriz Lima', cpf: '1', status: 'active', is_first_login: false, group_id: 'g1', plan_id: 'p1', color: null, access_channel: 'app' },
  { id: 'c', role: 'user', name: 'Carlos Eduardo', cpf: '2', status: 'active', is_first_login: true, group_id: null, plan_id: null, color: null, access_channel: 'app' },
  { id: 'r', role: 'professor', name: 'Rafael Tanaka', cpf: '3', status: 'active', is_first_login: false, group_id: null, plan_id: null, color: '#FB923C', access_channel: 'app' },
];

beforeEach(() => {
  mockFetchPessoas.mockReset().mockResolvedValue(PESSOAS);
  mockUpdateGroup.mockReset().mockResolvedValue(undefined);
  mockUpdatePlan.mockReset().mockResolvedValue(undefined);
  mockUpdateRole.mockReset().mockResolvedValue(undefined);
  mockNavigateParent.mockReset();
});

describe('PessoasScreen (opção A)', () => {
  function renderPessoas(navigate = jest.fn()) {
    return { tela: comProvedores(<PessoasScreen navigation={{ navigate } as never} route={{ key: 'p', name: 'Pessoas' } as never} />), navigate };
  }

  it('deveMostrarAsAbasOsFiltrosEALinhaLimpa', async () => {
    const { tela } = renderPessoas();
    expect(await tela.findByText('Ana Beatriz Lima')).toBeTruthy();
    expect(tela.getByText('Alunos · 2')).toBeTruthy();
    expect(tela.getByText('Equipe · 1')).toBeTruthy();
    expect(tela.getByText('Pendentes 1')).toBeTruthy();
    expect(tela.getByText('Turma Tarde · Mensal 2x')).toBeTruthy();
    expect(tela.getByText('1º acesso')).toBeTruthy();
    expect(tela.queryByText('Rafael Tanaka')).toBeNull();
  });

  it('deveAbrirAsAcoesEAFicha', async () => {
    const { tela, navigate } = renderPessoas();
    fireEvent.press(await tela.findByText('Ana Beatriz Lima'));
    expect(tela.getByText('Trocar turma ou plano')).toBeTruthy();
    expect(tela.queryByText('Promover a administrador')).toBeNull();
    fireEvent.press(tela.getByText('Ver ficha'));
    expect(navigate).toHaveBeenCalledWith('FichaAluno', { userId: 'a' });
  });

  it('deveAvisarAMudancaDeTurmaAntesDeSalvar', async () => {
    const { tela } = renderPessoas();
    fireEvent.press(await tela.findByText('Ana Beatriz Lima'));
    fireEvent.press(tela.getByText('Trocar turma ou plano'));
    fireEvent.press(tela.getByText('escolher Turma Manhã'));
    expect(tela.getByText(/A frequência continua contando as aulas da Turma Tarde até agora/)).toBeTruthy();
    expect(mockUpdateGroup).not.toHaveBeenCalled();
    fireEvent.press(tela.getByText('Salvar'));
    await waitFor(() => expect(mockUpdateGroup).toHaveBeenCalledWith('a', 'g2'));
  });

  it('deveOferecerAPromocaoSoNaEquipe', async () => {
    const { tela, navigate } = renderPessoas();
    fireEvent.press(await tela.findByText('Equipe · 1'));
    fireEvent.press(await tela.findByText('Rafael Tanaka'));
    expect(tela.getByText('Promover a administrador')).toBeTruthy();
    fireEvent.press(tela.getByText('Ver ficha'));
    expect(navigate).toHaveBeenCalledWith('FichaProfessor', { teacherId: 'r', name: 'Rafael Tanaka' });
  });

  it('deveCadastrarNoContextoDaAba', async () => {
    const { tela, navigate } = renderPessoas();
    fireEvent.press(await tela.findByLabelText('Cadastrar aluno'));
    expect(navigate).toHaveBeenCalledWith('CadastrarAluno');
  });

  it('deveMostrarOErro', async () => {
    mockFetchPessoas.mockRejectedValue(new Error('rede'));
    const { tela } = renderPessoas();
    expect(await tela.findByText('Não foi possível carregar as pessoas.')).toBeTruthy();
  });
});

describe('FichaAlunoScreen (§ 12, D32)', () => {
  const PERFIL = {
    nome: 'Ana Beatriz Lima',
    turma: 'Turma Manhã',
    modalidade: 'fixed',
    cotaOuMeta: null,
    situacao: 'ativo',
    naAcademiaDesde: '2026-02-10',
    frequenciaSemana: { percentual: 100, feitas: 2, esperadas: 2 },
    frequenciaMes: { percentual: 75, feitas: 6, esperadas: 8 },
    trocasPermanentes: [],
    turmasNoMes: [],
    planoNome: null,
    financeiro: null,
  };

  it('deveMostrarAFichaSemFinanceiroParaOProfessor', async () => {
    mockPerfilAluno.mockResolvedValue(PERFIL);
    mockHistoricoAluno.mockResolvedValue([
      { classId: 'x', dateTime: '2030-03-10T21:00:00Z', title: 'Muay Thai', cancelled: false, status: 'absent', origem: 'turma', justificationStatus: null, edited: false, swapOtherDateTime: null },
    ]);
    const tela = comProvedores(<FichaAlunoScreen route={{ params: { userId: 'a' } }} />);
    expect(await tela.findByText('Ana Beatriz Lima')).toBeTruthy();
    expect(tela.getByText('Falta')).toBeTruthy();
    expect(tela.queryByText('FINANCEIRO')).toBeNull();
    fireEvent.press(tela.getByText('Ver frequência'));
    expect(mockNavigateParent).toHaveBeenCalledWith('Aulas', { screen: 'HistoricoFrequencia', params: { userId: 'a', name: 'Ana Beatriz Lima' } });
  });

  it('deveMostrarOFinanceiroParaOAdmin', async () => {
    mockPerfilAluno.mockResolvedValue({ ...PERFIL, financeiro: { mesesNaAcademia: 8, pagas: 5, pagasComAtraso: 1, inadimplentes: 1, emAberto: 1 } });
    mockHistoricoAluno.mockResolvedValue([]);
    const tela = comProvedores(<FichaAlunoScreen route={{ params: { userId: 'a' } }} />);
    expect(await tela.findByText('5 pagas')).toBeTruthy();
    expect(tela.getByText('8 meses na academia')).toBeTruthy();
  });

  it('deveMostrarOErroComTentarDeNovo', async () => {
    mockPerfilAluno.mockRejectedValue(new Error('x'));
    mockHistoricoAluno.mockResolvedValue([]);
    const tela = comProvedores(<FichaAlunoScreen route={{ params: { userId: 'a' } }} />);
    expect(await tela.findByText('Não foi possível carregar a ficha.')).toBeTruthy();
  });
});

describe('FichaProfessorScreen (T32)', () => {
  it('deveMostrarOPercentualEOsNumeros', async () => {
    mockPerfilProfessor.mockResolvedValue({
      nome: 'Rafael', cor: '#FB923C', esperadas: 4, dadas: 2, dadasForaDaEscala: 1, canceladas: 1, faltas: 1, abonadas: 1, pendentes: 1, percentual: 66.67,
    });
    mockHistoricoProfessor.mockResolvedValue([
      { classId: 'y', dateTime: '2030-03-10T21:00:00Z', title: 'Muay Thai', cancelled: false, present: false, addedInRollCall: false },
    ]);
    const tela = comProvedores(
      <FichaProfessorScreen navigation={{} as never} route={{ key: 'f', name: 'FichaProfessor', params: { teacherId: 'r', name: 'Rafael' } } as never} />,
    );
    expect(await tela.findByText('66,67%')).toBeTruthy();
    expect(tela.getByLabelText('Faltas: 1')).toBeTruthy();
    expect(tela.getByText('Falta')).toBeTruthy();
  });
});
