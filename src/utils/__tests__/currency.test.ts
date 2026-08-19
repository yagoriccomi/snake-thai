import {
  centsToInput,
  formatCents,
  parseCurrencyToCents,
} from '@/utils/currency';

describe('formatCents', () => {
  it('deveFormatarCentavosComoMoedaBrasileira', () => {
    //   é o espaço não separável que o Intl usa depois de "R$".
    expect(formatCents(12990).replace(/ /g, ' ')).toBe('R$ 129,90');
  });

  it('deveExibirZeroComDuasCasas', () => {
    expect(formatCents(0).replace(/ /g, ' ')).toBe('R$ 0,00');
  });

  it('deveManterOsCentavosQuebradosSemArredondar', () => {
    expect(formatCents(1)).toContain('0,01');
    expect(formatCents(99)).toContain('0,99');
  });
});

describe('parseCurrencyToCents', () => {
  it('deveAceitarVirgulaComoDecimal', () => {
    expect(parseCurrencyToCents('129,90')).toBe(12990);
  });

  it('deveAceitarPontoComoDecimal', () => {
    expect(parseCurrencyToCents('129.90')).toBe(12990);
  });

  it('deveIgnorarOSimboloDaMoedaEEspacos', () => {
    expect(parseCurrencyToCents('R$ 129,90')).toBe(12990);
  });

  it('deveTratarSeparadorDeMilharSemConfundirComDecimal', () => {
    expect(parseCurrencyToCents('1.299,90')).toBe(129990);
  });

  it('deveCompletarComZeroQuandoFaltaCasaDecimal', () => {
    expect(parseCurrencyToCents('129,9')).toBe(12990);
  });

  it('deveAssumirZeroCentavosQuandoNaoHaDecimal', () => {
    expect(parseCurrencyToCents('129')).toBe(12900);
  });

  it('deveTruncarCasasExcedentesEmVezDeArredondarParaCima', () => {
    // 129,999 vira 129,99 — nunca 130,00: cobrar a mais do aluno é inaceitável.
    expect(parseCurrencyToCents('129,999')).toBe(12999);
  });

  it('deveRetornarNuloParaTextoSemNumero', () => {
    expect(parseCurrencyToCents('')).toBeNull();
    expect(parseCurrencyToCents('abc')).toBeNull();
    expect(parseCurrencyToCents('R$')).toBeNull();
  });
});

describe('centsToInput', () => {
  it('deveDevolverTextoEditavelSemSimbolo', () => {
    expect(centsToInput(12990)).toBe('129,90');
    expect(centsToInput(500)).toBe('5,00');
    expect(centsToInput(5)).toBe('0,05');
  });

  it('deveSerReversivelComParseCurrencyToCents', () => {
    [0, 1, 99, 500, 12990, 129990].forEach((cents) => {
      expect(parseCurrencyToCents(centsToInput(cents))).toBe(cents);
    });
  });
});
