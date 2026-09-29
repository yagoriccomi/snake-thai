import {
  assuntoDaJustificativa,
  NEGADA_PELA_SEGUNDA_VEZ,
  negadaPelaSegundaVez,
  rotuloDaJustificativa,
  tomDaJustificativa,
} from '@/utils/justificativas';

const BASE = { attempt: 1, approvedByName: null } as const;

describe('rotuloDaJustificativa (§ 3)', () => {
  it('deveDizerEmAnaliseQuandoPendente', () => {
    expect(rotuloDaJustificativa({ ...BASE, status: 'pending' })).toBe('Justificativa em análise');
  });

  it('deveNomearQuemAprovou', () => {
    expect(rotuloDaJustificativa({ ...BASE, status: 'approved', approvedByName: 'Ana' })).toBe(
      'Justificativa aprovada por Ana',
    );
  });

  it('deveAprovarSemNomeQuandoAContaSumiu', () => {
    expect(rotuloDaJustificativa({ ...BASE, status: 'approved' })).toBe('Justificativa aprovada');
  });

  it('deveMostrarOPrazoDoReenvioNaPrimeiraNegada', () => {
    expect(
      rotuloDaJustificativa({ ...BASE, status: 'rejected', canResend: true, resendUntil: '2026-10-05T15:00:00Z' }),
    ).toBe('Justificativa negada · você pode reenviar até 05/10');
  });

  it('naoDevePrometerReenvioDepoisDoPrazo', () => {
    expect(
      rotuloDaJustificativa({ ...BASE, status: 'rejected', canResend: false, resendUntil: '2026-10-05T15:00:00Z' }),
    ).toBe('Justificativa negada');
  });

  it('deveMandarProcurarAAcademiaNaSegundaNegada', () => {
    const estado = { status: 'rejected', attempt: 2, approvedByName: null } as const;
    expect(rotuloDaJustificativa(estado)).toBe(NEGADA_PELA_SEGUNDA_VEZ);
    expect(negadaPelaSegundaVez(estado)).toBe(true);
  });
});

describe('tomDaJustificativa', () => {
  it('deveUsarUmTomPorEstado', () => {
    expect([tomDaJustificativa('pending'), tomDaJustificativa('approved'), tomDaJustificativa('rejected')]).toEqual([
      'aviso',
      'destaque',
      'erro',
    ]);
  });
});

describe('assuntoDaJustificativa', () => {
  it('deveDescreverASemanaPelaSegundaFeira', () => {
    expect(assuntoDaJustificativa({ classTitle: null, classDateTime: null, weekStart: '2026-09-28' })).toBe(
      'Semana de 28/09',
    );
  });

  it('deveDescreverAAulaPeloTitulo', () => {
    expect(
      assuntoDaJustificativa({ classTitle: 'Muay Thai', classDateTime: '2026-09-28T15:00:00Z', weekStart: '2026-09-28' }),
    ).toMatch(/^Muay Thai · .+, 28\/09 • /);
  });
});
