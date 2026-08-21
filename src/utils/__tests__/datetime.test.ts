import {
  buildDayStrip,
  combineDateTimeToIso,
  formatDayMonth,
  formatTime,
} from '@/utils/datetime';

describe('combineDateTimeToIso', () => {
  it('combina data e hora válidas e faz round-trip nos formatadores', () => {
    const iso = combineDateTimeToIso('31/12/2030', '19:30');
    expect(iso).not.toBeNull();
    // Round-trip no fuso local (independe do timezone da máquina).
    expect(formatTime(iso as string)).toBe('19:30');
    expect(formatDayMonth(iso as string)).toBe('31/12');
  });

  it('rejeita data/hora incompleta ou inexistente', () => {
    expect(combineDateTimeToIso('31/12', '19:30')).toBeNull();
    expect(combineDateTimeToIso('31/12/2030', '99:99')).toBeNull();
    expect(combineDateTimeToIso('31/02/2030', '10:00')).toBeNull();
  });
});

describe('buildDayStrip', () => {
  it('gera N dias e marca o primeiro como hoje', () => {
    const days = buildDayStrip(new Date(), 7);
    expect(days).toHaveLength(7);
    expect(days[0]?.isToday).toBe(true);
    expect(days.every((day) => day.key.length === 10)).toBe(true);
  });
});
