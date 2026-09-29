import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

const mockFetchProfile = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'pessoa-1' } } } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));
jest.mock('@/services/auth.service', () => ({
  signOut: jest.fn(),
  signInWithPassword: jest.fn(),
  isBiometricAvailable: jest.fn().mockResolvedValue(false),
  authenticateBiometric: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/services/profile.service', () => ({
  fetchProfile: (...args: unknown[]): unknown => mockFetchProfile(...args),
}));
jest.mock('@/services/pushNotifications.service', () => ({ removerAparelhoAoSair: jest.fn() }));
jest.mock('@/services/biometricPreference.service', () => ({
  getBiometricChoice: jest.fn().mockResolvedValue('unset'),
  setBiometricChoice: jest.fn(),
  clearBiometricChoice: jest.fn(),
}));
jest.mock('@/lib/monitoring', () => ({ setMonitoringUser: jest.fn(), clearMonitoringUser: jest.fn() }));

import { AuthProvider, useAuth } from '@/context/AuthProvider';

function Papeis(): React.JSX.Element {
  const { profile, isAdmin, isProfessor, isStaff } = useAuth();
  if (profile === null) return <Text>sem perfil</Text>;
  return <Text>{`admin=${isAdmin} professor=${isProfessor} equipe=${isStaff}`}</Text>;
}

async function flagsDe(role: 'user' | 'professor' | 'admin'): Promise<string> {
  mockFetchProfile.mockResolvedValue({ id: 'pessoa-1', role, anonymized_at: null, is_first_login: false });
  const tela = render(
    <AuthProvider>
      <Papeis />
    </AuthProvider>,
  );
  const texto = await tela.findByText(/^admin=/);
  return String(texto.props.children);
}

beforeEach(() => {
  mockFetchProfile.mockReset();
});

describe('AuthProvider — papéis (contrato § 4)', () => {
  it('deveTratarOAdminComoEquipeSemViraProfessor', async () => {
    // isProfessor continua só o papel professor: a aba Financeiro depende disso.
    expect(await flagsDe('admin')).toBe('admin=true professor=false equipe=true');
  });

  it('deveTratarOProfessorComoEquipe', async () => {
    expect(await flagsDe('professor')).toBe('admin=false professor=true equipe=true');
  });

  it('naoDeveTratarOAlunoComoEquipe', async () => {
    expect(await flagsDe('user')).toBe('admin=false professor=false equipe=false');
  });
});
