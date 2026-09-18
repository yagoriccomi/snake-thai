import React from 'react';
import { Text } from 'react-native';
import Constants from 'expo-constants';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DevEnvironmentFrame } from '@/components/DevBanner';
import { ThemeProvider } from '@/theme/ThemeProvider';

const METRICAS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 40, left: 0, right: 0, bottom: 20 },
};

/** Diz quem aparece primeiro na árvore renderizada. */
function ordemNaArvore(primeiro: { parent: unknown }, segundo: { parent: unknown }): string {
  const caminho = (no: { parent: unknown }): unknown[] => {
    const nos: unknown[] = [];
    let atual: { parent: unknown } | null = no;
    while (atual !== null) {
      nos.unshift(atual);
      atual = atual.parent as { parent: unknown } | null;
    }
    return nos;
  };
  const a = caminho(primeiro);
  const b = caminho(segundo);
  const comum = a.findIndex((no, i) => no !== b[i]);
  const paiComum = (a[comum - 1] as { children: unknown[] }).children;
  return paiComum.indexOf(a[comum]) < paiComum.indexOf(b[comum]) ? 'conteudo-antes' : 'faixa-antes';
}

function renderMoldura(ativo: boolean) {
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ThemeProvider>
        <DevEnvironmentFrame ativo={ativo}>
          <Text>Conteúdo do app</Text>
        </DevEnvironmentFrame>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('DevEnvironmentFrame', () => {
  it('deveMostrarAFaixaComAVersaoNoAppDeDesenvolvimento', () => {
    const { getByText, getByLabelText } = renderMoldura(true);

    expect(getByText('DEV · v9.9.9')).toBeTruthy();
    expect(
      getByLabelText('Aplicativo de desenvolvimento, versão 9.9.9, conectado ao banco local'),
    ).toBeTruthy();
    expect(getByText('Conteúdo do app')).toBeTruthy();
  });

  it('deveFicarDepoisDoConteudo', () => {
    // A faixa fecha a tela embaixo, abaixo do menu — não disputa o topo com o
    // cabeçalho de cada tela.
    const { getByText } = renderMoldura(true);
    const textos = getByText('Conteúdo do app').props.children;

    expect(textos).toBe('Conteúdo do app');
    expect(ordemNaArvore(getByText('Conteúdo do app'), getByText('DEV · v9.9.9'))).toBe('conteudo-antes');
  });

  it('deveMostrarSoDEVQuandoOBuildNaoInformaAVersao', () => {
    const original = Constants.expoConfig;
    (Constants as { expoConfig: unknown }).expoConfig = { extra: {} };
    try {
      const { getByText } = renderMoldura(true);
      expect(getByText('DEV')).toBeTruthy();
    } finally {
      (Constants as { expoConfig: unknown }).expoConfig = original;
    }
  });

  it('naoDeveMostrarNadaAlemDoAppEmProducao', () => {
    const { queryByText, getByText } = renderMoldura(false);

    expect(queryByText('DEV · v9.9.9')).toBeNull();
    expect(getByText('Conteúdo do app')).toBeTruthy();
  });
});
