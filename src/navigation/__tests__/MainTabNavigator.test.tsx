import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockUseAuth = jest.fn();

jest.mock('@/context/AuthProvider', () => ({
  useAuth: (): unknown => mockUseAuth(),
}));

// As stacks de verdade carregam dados; aqui só importa QUAIS abas existem.
jest.mock('@/navigation/PainelStackNavigator', () => ({ PainelStackNavigator: () => null }));
jest.mock('@/navigation/AulasStackNavigator', () => ({ AulasStackNavigator: () => null }));
jest.mock('@/navigation/FinanceiroStackNavigator', () => ({ FinanceiroStackNavigator: () => null }));
jest.mock('@/navigation/DadosStackNavigator', () => ({ DadosStackNavigator: () => null }));

import { MainTabNavigator } from '@/navigation/MainTabNavigator';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function abasVisiveis(papel: { isAdmin: boolean; isProfessor: boolean }): string[] {
  mockUseAuth.mockReturnValue(papel);
  const tela = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <NavigationContainer>
          <MainTabNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  const nomes = ['Painel', 'Aulas', 'Financeiro', 'Dados'].filter(
    (nome) => tela.UNSAFE_queryAllByType(Text).some((texto) => texto.props.children === nome),
  );
  tela.unmount();
  return nomes;
}

describe('MainTabNavigator', () => {
  it('deveMostrarOPainelSoParaOAdminEComoPrimeiraAba', () => {
    expect(abasVisiveis({ isAdmin: true, isProfessor: false })).toEqual(['Painel', 'Aulas', 'Financeiro', 'Dados']);
  });

  it('naoDeveRegistrarPainelNemFinanceiroParaProfessor', () => {
    expect(abasVisiveis({ isAdmin: false, isProfessor: true })).toEqual(['Aulas', 'Dados']);
  });

  it('naoDeveRegistrarOPainelParaAluno', () => {
    expect(abasVisiveis({ isAdmin: false, isProfessor: false })).toEqual(['Aulas', 'Financeiro', 'Dados']);
  });
});
