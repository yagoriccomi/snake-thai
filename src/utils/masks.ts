/**
 * Utilitários de máscara e sanitização de entrada.
 *
 * Regra de segurança (LGPD/injeção): a UI exibe o valor MASCARADO, mas apenas
 * os DÍGITOS sanitizados são enviados ao backend. Nunca confie no texto cru.
 */

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Aplica a máscara de CPF progressivamente: `000.000.000-00`. */
export function maskCpf(value: string): string {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Aplica a máscara de celular brasileiro: `(00) 00000-0000`. */
export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

/** Aplica a máscara de data: `DD/MM/AAAA`. */
export function maskDate(value: string): string {
  return onlyDigits(value)
    .slice(0, 8)
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2');
}

/** Aplica a máscara de hora: `HH:MM`. */
export function maskTime(value: string): string {
  return onlyDigits(value)
    .slice(0, 4)
    .replace(/(\d{2})(\d)/, '$1:$2');
}

/**
 * Converte uma data `DD/MM/AAAA` para o formato ISO `AAAA-MM-DD` (aceito pelo
 * tipo `date` do Postgres). Retorna `null` se a entrada não for uma data completa.
 */
export function dateBrToIso(value: string): string | null {
  const digits = onlyDigits(value);
  if (digits.length !== 8) {
    return null;
  }
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return `${year}-${month}-${day}`;
}

/** Converte uma data ISO `AAAA-MM-DD` para exibição `DD/MM/AAAA`. */
export function dateIsoToBr(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length !== 8) {
    return '';
  }
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return `${day}/${month}/${year}`;
}
