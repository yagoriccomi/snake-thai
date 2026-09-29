import { ordenarDiasDeAula, resumoDosDiasDeAula } from '@/utils/diasDeAula';

describe('dias de aula (academy_settings.class_weekdays)', () => {
  it('deveOrdenarDeSegundaADomingoSemRepetir', () => {
    // 0 = domingo vai para o fim: a semana da academia começa na segunda.
    expect(ordenarDiasDeAula([0, 3, 1, 3])).toEqual([1, 3, 0]);
  });

  it('deveResumirDiasSeguidosComoIntervalo', () => {
    expect(resumoDosDiasDeAula([1, 2, 3, 4, 5, 6])).toBe('Seg a Sáb');
    expect(resumoDosDiasDeAula([6, 0, 5])).toBe('Sex a Dom');
  });

  it('deveListarDiasSalteados', () => {
    expect(resumoDosDiasDeAula([1, 3, 5])).toBe('Seg, Qua e Sex');
    expect(resumoDosDiasDeAula([2, 4])).toBe('Ter e Qui');
  });

  it('deveMostrarUmDiaSoOuTracoSemNenhum', () => {
    expect(resumoDosDiasDeAula([6])).toBe('Sáb');
    expect(resumoDosDiasDeAula([])).toBe('—');
  });
});
