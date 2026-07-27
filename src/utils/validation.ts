/**
 * Validações de entrada (defesa em profundidade — CLAUDE.md §3).
 * Todas operam sobre valores já sanitizados quando aplicável.
 */
import { onlyDigits } from '@/utils/masks';

/**
 * Regra de senha forte: mínimo 8 caracteres, com ao menos 1 maiúscula,
 * 1 minúscula, 1 dígito e 1 caractere especial.
 */
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/** Valida uma senha forte conforme a política do app. */
export function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD_REGEX.test(password);
}

/** Validação básica de formato de e-mail. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Um celular válido tem 10 (fixo/antigo) ou 11 (móvel) dígitos. */
export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11;
}

/**
 * Valida o CPF por formato E pelos dígitos verificadores (algoritmo oficial),
 * rejeitando sequências repetidas (ex.: 111.111.111-11).
 */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) {
    return false;
  }
  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf.charAt(index)) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    checkDigit(9) === Number(cpf.charAt(9)) &&
    checkDigit(10) === Number(cpf.charAt(10))
  );
}

/** Nome válido: pelo menos 3 caracteres não vazios. */
export function isValidName(value: string): boolean {
  return value.trim().length >= 3;
}

/**
 * Valida uma data de nascimento `DD/MM/AAAA`: existente no calendário, não
 * futura e com idade plausível (até 120 anos).
 */
export function isValidBirthDate(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 8) {
    return false;
  }
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  if (!isRealDate) {
    return false;
  }

  const now = new Date();
  if (date.getTime() > now.getTime()) {
    return false;
  }
  const oldest = new Date();
  oldest.setFullYear(oldest.getFullYear() - 120);
  return date.getTime() >= oldest.getTime();
}
