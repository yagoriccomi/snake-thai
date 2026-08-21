import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';

/**
 * Adapter de armazenamento seguro para a sessão de autenticação do Supabase.
 *
 * Por que não `SecureStore` direto? O Expo SecureStore tem limite prático de
 * ~2 KB por chave (Keychain/Keystore), e a sessão do Supabase (access token +
 * refresh token, possivelmente com claims customizadas) pode ultrapassá-lo.
 *
 * Por que não `AsyncStorage` direto? Ele persiste em TEXTO PURO — proibido para
 * tokens pela política de segurança do projeto (CLAUDE.md §3) e pela LGPD.
 *
 * Solução (padrão oficial da documentação do Supabase para React Native):
 * a cada escrita geramos uma chave AES-256 aleatória, ciframos o valor com
 * AES-CTR e guardamos o **ciphertext** no AsyncStorage. Apenas a chave de
 * criptografia (pequena, cabe no limite) vai para o SecureStore nativo. Sem a
 * chave protegida pelo enclave seguro do dispositivo, o ciphertext é inútil.
 */
class LargeSecureStore {
  /**
   * Cifra um valor com uma chave AES-256 recém-gerada e persiste essa chave
   * no armazenamento seguro nativo, indexada por `key`.
   *
   * @param key   Identificador da entrada (também indexa a chave no SecureStore).
   * @param value Texto claro a ser cifrado.
   * @returns O ciphertext em hexadecimal, pronto para ir ao AsyncStorage.
   */
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1),
    );
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  /**
   * Recupera a chave AES protegida e decifra o ciphertext correspondente.
   *
   * @param key   Identificador usado para recuperar a chave no SecureStore.
   * @param value Ciphertext em hexadecimal vindo do AsyncStorage.
   * @returns O texto claro, ou `null` se a chave de criptografia não existir.
   */
  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (encryptionKeyHex === null) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  /** Lê e decifra o valor associado a `key`. */
  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (encrypted === null) {
      return null;
    }
    return this.decrypt(key, encrypted);
  }

  /** Cifra `value` e persiste o ciphertext em `key`. */
  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  /** Remove tanto o ciphertext quanto a chave de criptografia associada. */
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

/** Instância única (singleton) do armazenamento seguro. */
export const largeSecureStore = new LargeSecureStore();
