import {
  PASSWORD_MIN_LENGTH,
  checkPasswordRequirements,
  describeMissingPasswordRules,
  isStrongPassword,
} from '@/utils/validation';

/** Localiza uma regra pelo id, falhando o teste se ela sumir da política. */
function ruleFor(password: string, id: string): boolean {
  const rule = checkPasswordRequirements(password).find((item) => item.id === id);
  if (rule === undefined) {
    throw new Error(`Regra "${id}" ausente da política de senha.`);
  }
  return rule.met;
}

describe('checkPasswordRequirements', () => {
  it('deveMarcarTodasAsRegrasComoCumpridasQuandoASenhaEForte', () => {
    const requirements = checkPasswordRequirements('Snake@2026');
    expect(requirements.every((rule) => rule.met)).toBe(true);
  });

  it('deveReprovarComprimentoAbaixoDoMinimo', () => {
    const short = 'Aa1@567';
    expect(short.length).toBeLessThan(PASSWORD_MIN_LENGTH);
    expect(ruleFor(short, 'length')).toBe(false);
  });

  it('deveIdentificarFaltaDeMaiuscula', () => {
    expect(ruleFor('snake@2026', 'uppercase')).toBe(false);
    expect(ruleFor('snake@2026', 'lowercase')).toBe(true);
  });

  it('deveIdentificarFaltaDeMinuscula', () => {
    expect(ruleFor('SNAKE@2026', 'lowercase')).toBe(false);
  });

  it('deveIdentificarFaltaDeNumero', () => {
    expect(ruleFor('SnakeThai@', 'digit')).toBe(false);
  });

  it('deveIdentificarFaltaDeCaractereEspecial', () => {
    expect(ruleFor('SnakeThai2026', 'special')).toBe(false);
  });

  it('deveManterAOrdemDeExibicaoEstavel', () => {
    const ids = checkPasswordRequirements('x').map((rule) => rule.id);
    expect(ids).toEqual(['length', 'uppercase', 'lowercase', 'digit', 'special']);
  });
});

describe('describeMissingPasswordRules', () => {
  it('deveRetornarNuloQuandoASenhaCumpreTodaAPolitica', () => {
    expect(describeMissingPasswordRules('Snake@2026')).toBeNull();
  });

  it('deveListarApenasOQueFaltaNaMensagem', () => {
    const message = describeMissingPasswordRules('snakethai');
    expect(message).not.toBeNull();
    expect(message).toContain('maiúscula');
    expect(message).toContain('número');
    expect(message).toContain('especial');
    expect(message).not.toContain('minúscula');
  });

  it('deveConcordarComIsStrongPassword', () => {
    const samples = ['Snake@2026', 'fraca', 'SEMNUMERO@abc', 'Sem3special'];
    samples.forEach((sample) => {
      expect(describeMissingPasswordRules(sample) === null).toBe(
        isStrongPassword(sample),
      );
    });
  });
});
