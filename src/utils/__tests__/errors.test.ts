import { classifyError, describeError } from '@/utils/errors';

describe('classifyError', () => {
  it('reconhece CPF duplicado (23505 com cpf nos detalhes) como erro de banco', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "profiles_cpf_key"',
      details: 'Key (cpf)=(52998224725) already exists.',
    };
    const result = classifyError(error);
    expect(result.kind).toBe('banco');
    expect(result.message).toBe('Este CPF já está cadastrado em outra conta.');
  });

  it('mapeia violação de unicidade genérica (23505 sem cpf)', () => {
    const result = classifyError({ code: '23505', message: 'duplicate key', details: '' });
    expect(result.kind).toBe('banco');
    expect(result.message).toBe('Já existe um cadastro com esses dados.');
  });

  it('mapeia negação de permissão (42501)', () => {
    const result = classifyError({ code: '42501', message: 'permission denied' });
    expect(result.kind).toBe('banco');
    expect(result.message).toBe('Você não tem permissão para esta ação.');
  });

  it('informa o código quando o SQLSTATE é desconhecido', () => {
    const result = classifyError({ code: '99999', message: 'algo estranho' });
    expect(result.kind).toBe('banco');
    expect(result.message).toContain('99999');
  });

  it('classifica falha de rede pela mensagem do fetch', () => {
    const result = classifyError(new TypeError('Network request failed'));
    expect(result.kind).toBe('rede');
    expect(result.message).toMatch(/conex/i);
  });

  it('classifica erro de autenticação e traduz credenciais inválidas', () => {
    const result = classifyError({ name: 'AuthApiError', message: 'Invalid login credentials' });
    expect(result.kind).toBe('auth');
    expect(result.message).toBe('E-mail ou senha inválidos.');
  });

  it('trata senha fraca do GoTrue', () => {
    const result = classifyError({ name: 'AuthWeakPasswordError', message: 'Password is too weak' });
    expect(result.kind).toBe('auth');
    expect(result.message).toMatch(/requisitos de segurança/i);
  });

  it('marca Error comum como interno e preserva a pista', () => {
    const result = classifyError(new Error('boom'));
    expect(result.kind).toBe('interno');
    expect(result.message).toBe('Erro interno: boom');
  });

  it('tem fallback interno para valores sem mensagem', () => {
    const result = classifyError(undefined);
    expect(result.kind).toBe('interno');
    expect(result.message).toMatch(/interno/i);
  });
});

describe('describeError', () => {
  it('retorna a mensagem amigável direto (nunca genérica)', () => {
    expect(describeError({ code: '23505', message: 'x', details: 'Key (cpf)=(1) already exists.' })).toBe(
      'Este CPF já está cadastrado em outra conta.',
    );
  });
});
