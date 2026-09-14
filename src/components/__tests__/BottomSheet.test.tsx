import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Portal, PortalProvider } from '@/components/Portal';
import { ThemeProvider } from '@/theme/ThemeProvider';

function renderSheet(visible: boolean, onClose = jest.fn()) {
  const utils = render(
    <ThemeProvider>
      <PortalProvider>
        <Text>Tela</Text>
        <BottomSheet visible={visible} onClose={onClose}>
          <Text>Conteúdo da folha</Text>
        </BottomSheet>
      </PortalProvider>
    </ThemeProvider>,
  );
  return { ...utils, onClose };
}

describe('BottomSheet', () => {
  it('deveRenderizarOConteudoAcimaDaTelaQuandoVisivel', () => {
    const { getByText } = renderSheet(true);
    expect(getByText('Tela')).toBeTruthy();
    expect(getByText('Conteúdo da folha')).toBeTruthy();
  });

  it('naoDeveRenderizarNadaQuandoFechada', () => {
    const { queryByText } = renderSheet(false);
    expect(queryByText('Conteúdo da folha')).toBeNull();
  });

  it('deveFecharAoTocarNoFundo', () => {
    const { getByLabelText, onClose } = renderSheet(true);
    // O fundo fica FORA da área modal (`accessibilityViewIsModal`): leitores de
    // tela não o anunciam, e a busca padrão da biblioteca respeita isso.
    fireEvent.press(getByLabelText('Fechar', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('deveRemoverOConteudoDoPortalQuandoAFolhaFecha', () => {
    const { queryByText, rerender } = renderSheet(true);
    rerender(
      <ThemeProvider>
        <PortalProvider>
          <Text>Tela</Text>
          <BottomSheet visible={false} onClose={jest.fn()}>
            <Text>Conteúdo da folha</Text>
          </BottomSheet>
        </PortalProvider>
      </ThemeProvider>,
    );
    expect(queryByText('Conteúdo da folha')).toBeNull();
  });
});

describe('Portal', () => {
  it('deveFalharDeFormaExplicitaForaDoProvider', () => {
    // Silencia o log do React sobre o erro esperado.
    const erroDoConsole = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Portal>{null}</Portal>)).toThrow('PortalProvider');
    erroDoConsole.mockRestore();
  });
});
