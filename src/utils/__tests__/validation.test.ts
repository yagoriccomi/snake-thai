import {
  isStrongPassword,
  isValidBirthDate,
  isValidCpf,
  isValidEmail,
  isValidName,
  isValidPhone,
} from '@/utils/validation';

describe('isStrongPassword', () => {
  it('aceita senha com maiúscula, minúscula, número e especial (>= 8)', () => {
    expect(isStrongPassword('Snake@123')).toBe(true);
    expect(isStrongPassword('Abcdef1@')).toBe(true);
  });

  it('rejeita senhas fracas', () => {
    expect(isStrongPassword('curta1@')).toBe(false); // < 8
    expect(isStrongPassword('semespecial1A')).toBe(false); // sem especial
    expect(isStrongPassword('SEM_MINUSCULA1@')).toBe(false); // sem minúscula
    expect(isStrongPassword('sem_maiuscula1@')).toBe(false); // sem maiúscula
    expect(isStrongPassword('SemNumero@A')).toBe(false); // sem número
  });
});

describe('isValidCpf', () => {
  it('valida um CPF com dígitos verificadores corretos', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('rejeita CPF inválido, sequência repetida e tamanho errado', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('valida e rejeita e-mails', () => {
    expect(isValidEmail('aluno@exemplo.com')).toBe(true);
    expect(isValidEmail('invalido@')).toBe(false);
    expect(isValidEmail('sem-arroba.com')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('aceita 10 ou 11 dígitos', () => {
    expect(isValidPhone('(11) 99999-8888')).toBe(true);
    expect(isValidPhone('1133334444')).toBe(true);
    expect(isValidPhone('999')).toBe(false);
  });
});

describe('isValidName', () => {
  it('exige ao menos 3 caracteres não vazios', () => {
    expect(isValidName('Ana')).toBe(true);
    expect(isValidName('  ab  ')).toBe(false);
  });
});

describe('isValidBirthDate', () => {
  it('aceita data real e passada', () => {
    expect(isValidBirthDate('31/12/1990')).toBe(true);
  });

  it('rejeita data inexistente ou futura', () => {
    expect(isValidBirthDate('31/02/1990')).toBe(false);
    expect(isValidBirthDate('31/12/2999')).toBe(false);
    expect(isValidBirthDate('1234')).toBe(false);
  });
});
