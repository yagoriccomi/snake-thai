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
