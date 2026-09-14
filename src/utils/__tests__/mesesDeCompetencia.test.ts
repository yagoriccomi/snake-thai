import { formatMonthShort, formatMonthYear } from '@/utils/datetime';

describe('formatMonthYear', () => {
  it('deveMostrarOMesDaCompetenciaSemDeslocarPorFuso', () => {
    // Via new Date, "2026-08-01" em UTC viraria 31 de julho em São Paulo.
    expect(formatMonthYear('2026-08-01')).toBe('Agosto de 2026');
  });

  it('deveCobrirDezembro', () => {
    expect(formatMonthYear('2025-12-01')).toBe('Dezembro de 2025');
  });
});

describe('formatMonthShort', () => {
  it('deveAbreviarMesEAno', () => {
    expect(formatMonthShort('2026-09-01')).toBe('Set/26');
  });
});
