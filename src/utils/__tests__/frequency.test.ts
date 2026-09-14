import { formatarPercentual } from '@/utils/frequency';

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
});
