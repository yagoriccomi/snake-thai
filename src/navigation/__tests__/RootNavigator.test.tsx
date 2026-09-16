import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockUseAuth = jest.fn();
const mockPrecisaAceitar = jest.fn();

jest.mock('@/context/AuthProvider', () => ({ useAuth: (): unknown => mockUseAuth() }));
jest.mock('@/context/LegalConsentProvider', () => ({
  useLegalConsent: () => ({ precisaAceitar: mockPrecisaAceitar() }),
}));
// Só importa QUAL tela a raiz escolhe; as telas de verdade carregam dados.
function mockTela(nome: string): () => React.JSX.Element {
  const { Text: Texto } = jest.requireActual<typeof import('react-native')>('react-native');
  return function TelaFalsa(): React.JSX.Element {
    return <Texto>{`tela:${nome}`}</Texto>;
  };
}
jest.mock('@/screens/LoadingScreen', () => ({ LoadingScreen: mockTela('Loading') }));
jest.mock('@/screens/auth/LoginScreen', () => ({ LoginScreen: mockTela('Login') }));
jest.mock('@/screens/auth/BiometricLockScreen', () => ({ BiometricLockScreen: mockTela('BiometricLock') }));
jest.mock('@/screens/onboarding/OnboardingScreen', () => ({ OnboardingScreen: mockTela('Onboarding') }));
jest.mock('@/screens/legal/AceiteDocumentosScreen', () => ({ AceiteDocumentosScreen: mockTela('AceiteDocumentos') }));
jest.mock('@/navigation/MainTabNavigator', () => ({ MainTabNavigator: mockTela('Main') }));

import { RootNavigator } from '@/navigation/RootNavigator';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function telaEscolhida(auth: { firstLogin?: boolean; adminLocked?: boolean }, precisaAceitar: boolean): string {
  mockUseAuth.mockReturnValue({
    initializing: false,
    loadingProfile: false,
    session: { user: { id: 'usuario-1' } },
    profile: { id: 'usuario-1', is_first_login: auth.firstLogin ?? false },
    adminLocked: auth.adminLocked ?? false,
  });
  mockPrecisaAceitar.mockReturnValue(precisaAceitar);
  const tela = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  const nome = tela.getByText(/^tela:/).props.children as string;
  tela.unmount();
  return nome;
}

describe('RootNavigator — aceite dos documentos legais', () => {
  it('deveMostrarATelaDeAceiteQuandoHaVersaoNova', () => {
    expect(telaEscolhida({}, true)).toBe('tela:AceiteDocumentos');
  });

  it('deveAbrirAsAbasQuandoNadaFaltaAceitar', () => {
    expect(telaEscolhida({}, false)).toBe('tela:Main');
  });

  it('deveRespeitarPrimeiroAcessoEDigitalAntesDoAceite', () => {
    expect(telaEscolhida({ firstLogin: true }, true)).toBe('tela:Onboarding');
    expect(telaEscolhida({ adminLocked: true }, true)).toBe('tela:BiometricLock');
  });
});
