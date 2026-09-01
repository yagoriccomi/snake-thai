import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { act, render } from '@testing-library/react-native';

import { WaitingState } from '@/components/WaitingState';
import { ThemeProvider } from '@/theme/ThemeProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const ESPERA = 'Enviando seu comprovante…';
const EXPLICACAO = 'O servidor está sendo iniciado. Isso pode levar até um minuto.';

describe('WaitingState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    /*
     * Sem isto os testes deixam de ser independentes [#48]: cada render agenda
     * o cronômetro da espera, e um `advanceTimersByTime` de um teste dispara
     * também os cronômetros que sobraram dos anteriores — fazendo o anúncio
     * ser contado no teste errado. O sintoma aparece longe da causa.
     */
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('deveInformarOQueEstaAcontecendoDesdeOPrimeiroInstante', () => {
    const { getByText } = renderWithTheme(<WaitingState message={ESPERA} />);
    expect(getByText(ESPERA)).toBeTruthy();
  });

  it('deveSerAnunciadoComoProgressoParaLeitoresDeTela', () => {
    const { getByRole } = renderWithTheme(<WaitingState message={ESPERA} />);
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('naoDeveExplicarADemoraEnquantoAEsperaAindaEhNormal', () => {
    // Explicar "está demorando" no primeiro segundo treina o usuário a
    // desconfiar de uma espera que ainda é perfeitamente comum.
    const { queryByText } = renderWithTheme(
      <WaitingState message={ESPERA} longWaitMessage={EXPLICACAO} patienceMs={4000} />,
    );
    act(() => {
      jest.advanceTimersByTime(3999);
    });
    expect(queryByText(EXPLICACAO)).toBeNull();
  });

  it('deveExplicarADemoraQuandoAEsperaPassaDoEsperado', () => {
    const { getByText } = renderWithTheme(
      <WaitingState message={ESPERA} longWaitMessage={EXPLICACAO} patienceMs={4000} />,
    );
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(getByText(EXPLICACAO)).toBeTruthy();
  });

  it('deveAnunciarADemoraNoIosOndeALiveRegionNaoFunciona', () => {
    // `accessibilityLiveRegion` é Android-only. Sem este anúncio explícito o
    // VoiceOver fica em silêncio durante todo o cold start. WCAG 4.1.3.
    const anunciar = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    // `spyOn` sobre um método já espionado devolve o MESMO mock, com o
    // histórico de chamadas do teste anterior junto. Sem zerar, este teste
    // mede o que o outro fez. [#48]
    anunciar.mockClear();
    const plataformaOriginal = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });

    try {
      renderWithTheme(
        <WaitingState message={ESPERA} longWaitMessage={EXPLICACAO} patienceMs={4000} />,
      );
      act(() => {
        jest.advanceTimersByTime(4000);
      });
      expect(anunciar).toHaveBeenCalledWith(EXPLICACAO);
    } finally {
      Object.defineProperty(Platform, 'OS', {
        value: plataformaOriginal,
        configurable: true,
      });
    }
  });

  it('naoDeveAnunciarDuasVezesNoAndroidQueJaTemRegiaoViva', () => {
    const anunciar = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined);
    // `spyOn` sobre um método já espionado devolve o MESMO mock, com o
    // histórico de chamadas do teste anterior junto. Sem zerar, este teste
    // mede o que o outro fez. [#48]
    anunciar.mockClear();
    const plataformaOriginal = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });

    try {
      renderWithTheme(
        <WaitingState message={ESPERA} longWaitMessage={EXPLICACAO} patienceMs={4000} />,
      );
      act(() => {
        jest.advanceTimersByTime(4000);
      });
      expect(anunciar).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', {
        value: plataformaOriginal,
        configurable: true,
      });
    }
  });

  it('naoDeveProrromperExplicacaoQuandoNaoHaMotivoParaDemorar', () => {
    // Sem `longWaitMessage`, o componente é só um spinner honesto: nada de
    // inventar uma justificativa que o chamador não deu.
    const { queryByText } = renderWithTheme(<WaitingState message={ESPERA} />);
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(queryByText(EXPLICACAO)).toBeNull();
  });
});
