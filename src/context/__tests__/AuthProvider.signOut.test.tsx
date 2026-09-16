import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const ordem: string[] = [];
const mockRemoverAparelho = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'usuario-1' } } } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));
jest.mock('@/services/auth.service', () => ({
  signOut: (...args: unknown[]): unknown => mockSignOut(...args),
  signInWithPassword: jest.fn(),
  isBiometricAvailable: jest.fn().mockResolvedValue(false),
  authenticateBiometric: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/services/profile.service', () => ({
  fetchProfile: jest.fn().mockResolvedValue({ id: 'usuario-1', role: 'user', anonymized_at: null, is_first_login: false }),
}));
jest.mock('@/services/pushNotifications.service', () => ({
  removerAparelhoAoSair: (...args: unknown[]): unknown => mockRemoverAparelho(...args),
}));
jest.mock('@/services/biometricPreference.service', () => ({
  getBiometricChoice: jest.fn().mockResolvedValue('unset'),
  setBiometricChoice: jest.fn(),
  clearBiometricChoice: jest.fn(),
}));
jest.mock('@/lib/monitoring', () => ({ setMonitoringUser: jest.fn(), clearMonitoringUser: jest.fn() }));

import { AuthProvider, useAuth } from '@/context/AuthProvider';

function Sair(): React.JSX.Element {
  const { signOut, profile } = useAuth();
  return (
    <Text accessibilityRole="button" onPress={() => void signOut()}>
      {profile === null ? 'sem perfil' : 'logado'}
    </Text>
  );
}

beforeEach(() => {
  ordem.length = 0;
  mockRemoverAparelho.mockReset().mockImplementation(async () => {
    ordem.push('remover-aparelho');
  });
  mockSignOut.mockReset().mockImplementation(async () => {
    ordem.push('encerrar-sessao');
  });
});

describe('AuthProvider.signOut', () => {
  it('deveTirarOAparelhoDoBancoAntesDeEncerrarASessao', async () => {
    const { findByText, getByRole } = render(
      <AuthProvider>
        <Sair />
      </AuthProvider>,
    );
    await findByText('logado');

    fireEvent.press(getByRole('button'));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    // Sem o JWT a RLS não deixa apagar o aparelho: a ordem importa.
    expect(ordem).toEqual(['remover-aparelho', 'encerrar-sessao']);
    expect(mockRemoverAparelho).toHaveBeenCalledWith('usuario-1');
  });
});
