import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { RollCallDraftNotice } from '@/components/RollCallDraftNotice';
import type { AvisoDoRascunho } from '@/hooks/useRollCallDraft';
import { ThemeProvider } from '@/theme/ThemeProvider';

const SALVO_EM = '2026-09-16T13:05:00.000Z';

function renderAviso(aviso: AvisoDoRascunho) {
  const callbacks = { onDescartar: jest.fn(), onUsarMeuRascunho: jest.fn(), onManterSalvo: jest.fn() };
  const tela = render(
    <ThemeProvider>
      <RollCallDraftNotice aviso={aviso} {...callbacks} />
    </ThemeProvider>,
  );
  return { ...tela, ...callbacks };
}

describe('RollCallDraftNotice', () => {
  it('deveAvisarRascunhoRecuperadoEOferecerDescartar', () => {
    const { getByText, UNSAFE_getByProps, queryByText, onDescartar } = renderAviso({
      tipo: 'recuperado',
      salvoEm: SALVO_EM,
    });

    expect(getByText('Rascunho recuperado')).toBeTruthy();
    expect(getByText(/ainda não foram salvas/)).toBeTruthy();
    // O cartão não é `accessible` de propósito: agruparia os botões num foco só no TalkBack.
    expect(UNSAFE_getByProps({ accessibilityRole: 'alert', accessibilityLiveRegion: 'polite' })).toBeTruthy();
    expect(queryByText('Usar meu rascunho')).toBeNull();

    fireEvent.press(getByText('Descartar rascunho'));
    expect(onDescartar).toHaveBeenCalledTimes(1);
  });

  it('devePedirDecisaoNoConflitoEChamarCadaEscolha', () => {
    const { getByText, queryByText, onUsarMeuRascunho, onManterSalvo, onDescartar } = renderAviso({
      tipo: 'conflito',
      salvoEm: SALVO_EM,
    });

    expect(getByText(/salva por outra pessoa depois do seu rascunho/)).toBeTruthy();
    expect(queryByText('Descartar rascunho')).toBeNull();

    fireEvent.press(getByText('Usar meu rascunho'));
    fireEvent.press(getByText('Manter o que está salvo'));

    expect(onUsarMeuRascunho).toHaveBeenCalledTimes(1);
    expect(onManterSalvo).toHaveBeenCalledTimes(1);
    expect(onDescartar).not.toHaveBeenCalled();
  });
});
