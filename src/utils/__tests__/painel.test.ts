import {
  alturasDasBarras,
  contagem,
  faixaDoAtraso,
  percentualRecebido,
  rotuloAcessivelDoMes,
} from '@/utils/painel';

describe('percentualRecebido', () => {
  it('deveArredondarParaInteiro', () => {
    expect(percentualRecebido(140000, 500000)).toBe(28);
    expect(percentualRecebido(1, 3)).toBe(33);
    expect(percentualRecebido(2, 3)).toBe(67);
  });

  it('deveDevolverNuloSemNadaEsperado', () => {
    expect(percentualRecebido(0, 0)).toBeNull();
  });

  it('deveLimitarA100QuandoEntrouMaisDoQueOEsperado', () => {
    expect(percentualRecebido(12000, 10000)).toBe(100);
  });
});

describe('alturasDasBarras', () => {
  it('deveSerProporcionalAoMaiorValor', () => {
    expect(alturasDasBarras([500000, 250000, 0], 120)).toEqual([120, 60, 0]);
  });

  it('deveDarZeroSemNaNQuandoTudoEZero', () => {
    const alturas = alturasDasBarras([0, 0, 0], 120);
    expect(alturas).toEqual([0, 0, 0]);
    expect(alturas.some(Number.isNaN)).toBe(false);
  });

  it('deveAceitarListaVazia', () => {
    expect(alturasDasBarras([], 120)).toEqual([]);
  });
});

describe('faixaDoAtraso', () => {
  it.each([
    [1, '1-30'],
    [30, '1-30'],
    [31, '31-60'],
    [60, '31-60'],
    [61, '60+'],
  ])('%i dias ficam em %s', (dias, faixa) => {
    expect(faixaDoAtraso(dias)).toBe(faixa);
  });
});

describe('textos', () => {
  it('deveDescreverOMesParaOLeitorDeTela', () => {
    const rotulo = rotuloAcessivelDoMes('2026-08-01', 500000, 460000);
    expect(rotulo).toMatch(/^Agosto de 2026: esperado R\$\s?5\.000,00, recebido R\$\s?4\.600,00$/);
  });

  it('deveFlexionarAContagem', () => {
    expect(contagem(1, 'aluno', 'alunos')).toBe('1 aluno');
    expect(contagem(3, 'aluno', 'alunos')).toBe('3 alunos');
  });
});
