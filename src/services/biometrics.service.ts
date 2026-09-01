import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Serviço de autenticação biométrica (FaceID/TouchID/impressão digital),
 * usado como camada extra de segurança para administradores.
 */

/** Indica se o aparelho possui hardware biométrico E biometria cadastrada. */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return false;
  }
  return LocalAuthentication.isEnrolledAsync();
}

/**
 * Solicita a verificação biométrica. Permite o fallback para o código do
 * dispositivo (`disableDeviceFallback: false`) caso a leitura falhe.
 *
 * @returns `true` se a identidade foi confirmada.
 */
export async function authenticateBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirme sua identidade para acessar o painel de administrador',
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false,
  });
  return result.success;
}
