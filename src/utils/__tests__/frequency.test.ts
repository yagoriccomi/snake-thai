import { semanaDoMes } from '@/test-utils/frequencia';
import {
  acumularSemanas,
  avisoDeMesAberto,
  formatarPercentual,
  periodoDaSemana,
  rotulosDaFrequencia,
  textoDeContagem,
  tomDoPercentual,
} from '@/utils/frequency';

describe('formatarPercentual', () => {
  it('deveUsarVirgulaDecimal', () => {
    expect(formatarPercentual(91.67)).toBe('91,67%');
  });

  it('naoDeveMostrarCasasInuteis', () => {
    expect(formatarPercentual(100)).toBe('100%');
  });

  it('naoDeveArredondarDeNovoOQueOBancoJaArredondou', () => {
    expect(formatarPercentual(66.67)).toBe('66,67%');
  });

  it('deveMostrarAcimaDeCemSemTeto', () => {
    expect(formatarPercentual(112.5)).toBe('112,5%');
  });

  it('deveMostrarTracoComEsperadoZero', () => {
    expect(formatarPercentual(null)).toBe('—');
  });
});

describe('rótulos e tons (contrato § 3)', () => {
  it('deveMontarAContagem', () => {
    expect(textoDeContagem(3, 8)).toBe('3 de 8');
  });

  it('deveTrocarPelaMetaNoAVontade', () => {
    expect(rotulosDaFrequencia('unlimited')).toEqual({ semana: 'Meta da semana', mes: 'Meta do mês' });
    expect(rotulosDaFrequencia('free')).toEqual({ semana: 'Semana', mes: 'Mês' });
    expect(rotulosDaFrequencia('fixed')).toEqual({ semana: 'Semana', mes: 'Mês' });
  });

  it('deveDarOAcentoAPartirDeCem', () => {
    expect(tomDoPercentual(150)).toBe('acima');
    expect(tomDoPercentual(100)).toBe('acima');
    expect(tomDoPercentual(50)).toBe('abaixo');
    expect(tomDoPercentual(null)).toBe('neutro');
  });

  it('deveMostrarOPeriodoDaSemana', () => {
    expect(periodoDaSemana({ weekStart: '2027-02-01', weekEnd: '2027-02-07', isSplit: false })).toBe('01–07');
    expect(periodoDaSemana({ weekStart: '2026-09-28', weekEnd: '2026-10-04', isSplit: true })).toBe('28/09 – 04/10');
  });
});

describe('avisoDeMesAberto', () => {
  const setembro = { referenceMonth: '2026-09-01', closesOn: '2026-10-04', isClosed: false };

  it('deveAvisarQuandoOMesAcabouEAindaNaoFechou', () => {
    expect(avisoDeMesAberto(setembro, '2026-10-02')).toBe('Fecha em 04/10, quando a semana extra terminar');
  });

  it('naoDeveAvisarNoMesCorrente', () => {
    expect(avisoDeMesAberto(setembro, '2026-09-29')).toBeNull();
  });

  it('naoDeveAvisarDepoisDeFechado', () => {
    expect(avisoDeMesAberto({ ...setembro, isClosed: true }, '2026-10-05')).toBeNull();
  });
});

describe('acumularSemanas — o exemplo do dono (D8)', () => {
  it('deveSomarAsPresencasSobreOEsperadoDoMesInteiro', () => {
    const semanas = [3, 1, 0, 4].map((feitas, i) =>
      semanaDoMes({ weekStart: `2027-02-0${i + 1}`, attendedInMonth: feitas, attendedWeek: feitas }),
    );
    const linhas = acumularSemanas(semanas, 8);
    expect(linhas.map((l) => [l.feitasAteAqui, l.percentualAteAqui])).toEqual([
      [3, 37.5],
      [4, 50],
      [4, 50],
      [8, 100],
    ]);
  });

  it('deveDarNuloSemEsperado', () => {
    expect(acumularSemanas([semanaDoMes({ attendedInMonth: 1 })], 0)[0]?.percentualAteAqui).toBeNull();
  });
});
