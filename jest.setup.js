/* eslint-disable */
// Mocks de módulos nativos para o ambiente de testes (Jest).

// Ícones: renderiza qualquer ícone como um componente simples (evita carregar
// fontes nativas via expo-font durante os testes).
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = (props) => React.createElement(Text, props, null);
  return new Proxy(
    {},
    {
      get: () => Icon,
    },
  );
});

// Biometria: sem hardware por padrão nos testes.
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));

// Sentry: SDK nativo fora do Jest. O escopo do withScope é um objeto falso
// para os testes do monitoramento conferirem tags, extras e fingerprint.
jest.mock('@sentry/react-native', () => {
  const escopo = {
    setTag: jest.fn(),
    setExtras: jest.fn(),
    setExtra: jest.fn(),
    setFingerprint: jest.fn(),
  };
  return {
    __escopo: escopo,
    init: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
    setUser: jest.fn(),
    setTag: jest.fn(),
    withScope: jest.fn((callback) => callback(escopo)),
    nativeCrash: jest.fn(),
    wrap: jest.fn((componente) => componente),
  };
});
