import {
  descreverAceite,
  descreverVersaoDoDocumento,
  ordenarDocumentosLegais,
  parseLegalText,
  rotuloDoAceite,
} from '@/utils/legalText';

describe('parseLegalText', () => {
  it('deveSepararTituloSecaoParagrafoEItens', () => {
    const texto = [
      '# Política de Privacidade',
      '',
      'Primeira linha',
      'continua o parágrafo.',
      '',
      '## 1. Quem somos',
      'Cadastro:',
      '- nome e CPF;',
      '- celular.',
      'Depois da lista.',
    ].join('\r\n');

    expect(parseLegalText(texto)).toEqual([
      { tipo: 'titulo', texto: 'Política de Privacidade' },
      { tipo: 'paragrafo', texto: 'Primeira linha continua o parágrafo.' },
      { tipo: 'secao', texto: '1. Quem somos' },
      { tipo: 'paragrafo', texto: 'Cadastro:' },
      { tipo: 'item', texto: 'nome e CPF;' },
      { tipo: 'item', texto: 'celular.' },
      { tipo: 'paragrafo', texto: 'Depois da lista.' },
    ]);
  });

  it('deveTratarSubsecaoComoSecaoEManterMarcacaoSemEspacoComoTexto', () => {
    expect(parseLegalText('### Detalhe\n#hashtag\n-sem espaço\n**negrito**')).toEqual([
      { tipo: 'secao', texto: 'Detalhe' },
      { tipo: 'paragrafo', texto: '#hashtag -sem espaço **negrito**' },
    ]);
  });

  it('deveIgnorarMarcadorVazioETextoEmBranco', () => {
    expect(parseLegalText('#  \n- \n\n  ')).toEqual([]);
  });
});

describe('ordenarDocumentosLegais', () => {
  it('deveColocarAPoliticaAntesDosTermos', () => {
    const ordenados = ordenarDocumentosLegais([{ tipo: 'terms_of_use' as const }, { tipo: 'privacy_policy' as const }]);
    expect(ordenados.map((documento) => documento.tipo)).toEqual(['privacy_policy', 'terms_of_use']);
  });
});

describe('textos do aceite', () => {
  it('deveDescreverVersaoEDataDePublicacao', () => {
    expect(descreverVersaoDoDocumento({ versao: '1.0', publicadoEm: '2026-09-16T15:00:00Z' })).toBe(
      'Versão 1.0 · publicada em 16/09/2026',
    );
  });

  it('deveDizerSeAPessoaJaAceitou', () => {
    expect(descreverAceite(null)).toBe('Você ainda não aceitou esta versão.');
    expect(descreverAceite('2026-09-17T15:00:00Z')).toBe('Você aceitou em 17/09/2026.');
  });

  it('deveManterAFraseAntigaSemDocumentoPublicado', () => {
    expect(rotuloDoAceite([])).toBe('Concordo com os Termos de Uso e a Política de Privacidade (LGPD).');
  });

  it('deveCitarSoOsDocumentosQueEstaoSendoAceitos', () => {
    expect(rotuloDoAceite([{ tipo: 'terms_of_use' }, { tipo: 'privacy_policy' }])).toBe(
      'Li e concordo com a Política de Privacidade e os Termos de Uso.',
    );
    expect(rotuloDoAceite([{ tipo: 'terms_of_use' }])).toBe('Li e concordo com os Termos de Uso.');
  });
});
