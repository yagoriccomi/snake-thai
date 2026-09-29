import React from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';

type OuvinteDeSessao = (evento: string, sessao: unknown) => void;
const mockOuvintes: OuvinteDeSessao[] = [];
const mockFetchProfile = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'aluno-1' } } } }),
      onAuthStateChange: jest.fn((ouvinte: OuvinteDeSessao) => {
        mockOuvintes.push(ouvinte);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
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

const perfil = (primeiroAcesso: boolean) => ({
  id: 'aluno-1',
  role: 'user',
  anonymized_at: null,
  is_first_login: primeiroAcesso,
});

/** Guarda cada estado que o RootNavigator enxergaria, para saber se "Carregando" apareceu. */
const estadosVistos: string[] = [];
let recarregar: () => Promise<void> = async () => {};

function Espiao(): React.JSX.Element {
  const { loadingProfile, profile, refreshProfile } = useAuth();
  recarregar = refreshProfile;
  const estado = loadingProfile ? 'carregando' : profile === null ? 'sem perfil' : `primeiro=${profile.is_first_login}`;
  estadosVistos.push(estado);
  return <Text>{estado}</Text>;
}

function emitirSessaoNova(evento: string): void {
  // Cada evento do Supabase traz um objeto de sessão novo, do mesmo usuário.
  act(() => mockOuvintes.forEach((ouvinte) => ouvinte(evento, { user: { id: 'aluno-1' } })));
}

beforeEach(() => {
  mockOuvintes.length = 0;
  estadosVistos.length = 0;
  mockFetchProfile.mockReset();
});

describe('AuthProvider — recarga do perfil', () => {
  it('naoDeveMostrarCarregandoAoRecarregarOMesmoUsuario', async () => {
    mockFetchProfile.mockResolvedValue(perfil(true));
    const tela = render(
      <AuthProvider>
        <Espiao />
      </AuthProvider>,
    );
    await tela.findByText('primeiro=true');
    estadosVistos.length = 0;

    // O USER_UPDATED da troca de senha: antes, o Onboarding era desmontado aqui.
    emitirSessaoNova('USER_UPDATED');
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalledTimes(2));
    await tela.findByText('primeiro=true');

    expect(estadosVistos).not.toContain('carregando');
  });

  it('deveDescartarACargaAntigaQueChegaDepoisDoRefresh', async () => {
    mockFetchProfile.mockResolvedValueOnce(perfil(true));
    const tela = render(
      <AuthProvider>
        <Espiao />
      </AuthProvider>,
    );
    await tela.findByText('primeiro=true');

    // A recarga do USER_UPDATED sai antes de a flag cair e demora a voltar…
    let responderAntiga: (valor: unknown) => void = () => {};
    mockFetchProfile.mockReturnValueOnce(new Promise((resolver) => (responderAntiga = resolver)));
    emitirSessaoNova('USER_UPDATED');
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalledTimes(2));

    // …o Onboarding baixa a flag e pede o perfil de novo, que volta primeiro.
    mockFetchProfile.mockResolvedValueOnce(perfil(false));
    await act(async () => {
      await recarregar();
    });
    await tela.findByText('primeiro=false');

    // A resposta velha (flag ainda true) chega por último e não pode valer.
    await act(async () => {
      responderAntiga(perfil(true));
      await Promise.resolve();
    });

    expect(tela.getByText('primeiro=false')).toBeTruthy();
  });

  it('deveSairDoCarregandoMesmoQuandoACargaInicialEhSuperada', async () => {
    let responderPrimeira: (valor: unknown) => void = () => {};
    mockFetchProfile.mockReturnValueOnce(new Promise((resolver) => (responderPrimeira = resolver)));
    const tela = render(
      <AuthProvider>
        <Espiao />
      </AuthProvider>,
    );
    await tela.findByText('carregando');

    // Um refresh no meio da primeira carga não pode deixar a tela presa em "Carregando".
    mockFetchProfile.mockResolvedValueOnce(perfil(false));
    await act(async () => {
      await recarregar();
    });
    await act(async () => {
      responderPrimeira(perfil(true));
      await Promise.resolve();
    });

    await tela.findByText('primeiro=false');
  });

  it('deveManterOPerfilQuandoARecargaFalha', async () => {
    mockFetchProfile.mockResolvedValueOnce(perfil(true));
    const tela = render(
      <AuthProvider>
        <Espiao />
      </AuthProvider>,
    );
    await tela.findByText('primeiro=true');

    mockFetchProfile.mockRejectedValueOnce(new TypeError('Network request failed'));
    emitirSessaoNova('TOKEN_REFRESHED');
    await waitFor(() => expect(mockFetchProfile).toHaveBeenCalledTimes(2));

    // Falha transitória não derruba a sessão nem esvazia a tela.
    expect(tela.getByText('primeiro=true')).toBeTruthy();
  });
});
