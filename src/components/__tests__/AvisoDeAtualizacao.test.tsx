import React from 'react';
import { BackHandler, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/config/env', () => ({ env: { appVariant: 'production' } }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { CartaoDoAvisoDeAtualizacao } from '@/components/AvisoDeAtualizacao';
import { PortalProvider } from '@/components/Portal';
import { ThemeProvider } from '@/theme/ThemeProvider';

const ATUALIZACAO = {
  instalada: '1.9.0',
  nova: '2.0.0',
  link: 'https://github.com/yagoriccomi/snake-thai/releases/download/v2.0.0/snake-thai-v2.0.0.apk',
};

function renderizar() {
  const onBaixar = jest.fn();
  const onDispensar = jest.fn();
  const tela = render(
    <ThemeProvider>
      <PortalProvider>
        <Text>Login</Text>
        <CartaoDoAvisoDeAtualizacao atualizacao={ATUALIZACAO} onBaixar={onBaixar} onDispensar={onDispensar} />
      </PortalProvider>
    </ThemeProvider>,
  );
  return { ...tela, onBaixar, onDispensar };
}

describe('CartaoDoAvisoDeAtualizacao', () => {
  it('deveMostrarOsTextosExatosDoContratoSobreATelaAtual', () => {
    const { getByText } = renderizar();

    expect(getByText('Login')).toBeTruthy();
    expect(getByText('Nova versão disponível')).toBeTruthy();
    expect(
      getByText(
        'A versão 1.9.0 deste aplicativo pode apresentar mal funcionamento. Recomendamos atualizar para a versão 2.0.0.',
      ),
    ).toBeTruthy();
    expect(getByText('Este aviso aparece uma vez por dia até você atualizar.')).toBeTruthy();
    expect(getByText('Baixar atualização')).toBeTruthy();
    expect(getByText('Agora não')).toBeTruthy();
  });

  it('deveBaixarAoTocarNoBotaoPrincipal', () => {
    const { getByRole, onBaixar, onDispensar } = renderizar();

    fireEvent.press(getByRole('button', { name: 'Baixar atualização' }));

    expect(onBaixar).toHaveBeenCalledTimes(1);
    expect(onDispensar).not.toHaveBeenCalled();
  });

  it('deveDispensarAoTocarEmAgoraNao', () => {
    const { getByRole, onDispensar } = renderizar();

    fireEvent.press(getByRole('button', { name: 'Agora não' }));

    expect(onDispensar).toHaveBeenCalledTimes(1);
  });

  it('deveDispensarComOVoltarDoAndroid', () => {
    const ouvintes: (() => boolean)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_evento, ouvinte) => {
      ouvintes.push(ouvinte as () => boolean);
      return { remove: jest.fn() };
    });
    const { onDispensar } = renderizar();

    const consumiu = ouvintes.map((ouvinte) => ouvinte());

    expect(consumiu).toContain(true);
    expect(onDispensar).toHaveBeenCalledTimes(1);
  });

  it('deveMarcarOTituloComoCabecalho', () => {
    const { getByRole } = renderizar();
    expect(getByRole('header', { name: 'Nova versão disponível' })).toBeTruthy();
  });
});
