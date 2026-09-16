const fs = require('fs');
const path = require('path');

const { parseLegalText } = require('@/utils/legalText');
const {
  delimitadorLivre,
  montarMigration,
  nomeDaMigration,
  problemasDaPublicacao,
} = require('../publicar-documento-legal');

describe('problemasDaPublicacao', () => {
  it('deveAceitarTextoPreenchidoComVersaoValida', () => {
    expect(problemasDaPublicacao('1.0', '# Política\n\nTexto final.')).toEqual([]);
  });

  it('deveRecusarRascunhoComCamposAPreencher', () => {
    const problemas = problemasDaPublicacao('1.0', 'CNPJ [PREENCHER: CNPJ]\nEndereço [PREENCHER: endereço]');
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('2 linha(s)');
  });

  it('deveRecusarVersaoComEspacoOuAspas', () => {
    expect(problemasDaPublicacao("1.0'; drop", 'Texto')).toHaveLength(1);
    expect(problemasDaPublicacao('', 'Texto')).toHaveLength(1);
  });

  it('deveRecusarDocumentoVazio', () => {
    expect(problemasDaPublicacao('1.0', '  \n ')).toEqual(['O documento está vazio.']);
  });
});

describe('montarMigration', () => {
  it('deveColocarOTextoLiteralComAspasEQuebrasDeLinha', () => {
    const sql = montarMigration({ tipo: 'privacy_policy', versao: '1.0', conteudo: "# Título\r\n\nD'Ávila\n" });
    expect(sql).toContain("select public.publicar_documento_legal('privacy_policy', '1.0', $texto$# Título\n\nD'Ávila\n$texto$);");
  });

  it('deveTrocarODelimitadorQuandoEleApareceNoTexto', () => {
    expect(delimitadorLivre('custa $texto$ e $texto1$')).toBe('$texto2$');
    const sql = montarMigration({ tipo: 'terms_of_use', versao: '2', conteudo: 'a $texto$ b' });
    expect(sql).toContain('$texto1$a $texto$ b\n$texto1$');
  });
});

describe('nomeDaMigration', () => {
  it('deveUsarCarimboUtcEVersaoSemPontos', () => {
    const agora = new Date(Date.UTC(2026, 9, 1, 13, 5, 9));
    expect(nomeDaMigration('privacy_policy', '1.0', agora)).toBe('20261001130509_publicar_privacy_policy_1_0.sql');
  });
});

describe('rascunhos em docs/legal', () => {
  const ler = (arquivo) => fs.readFileSync(path.join(__dirname, '../../docs/legal', arquivo), 'utf8');

  it.each(['POLITICA-DE-PRIVACIDADE.md', 'TERMOS-DE-USO.md'])('deveUsarSoAMarcacaoQueOAppEntende %s', (arquivo) => {
    const blocos = parseLegalText(ler(arquivo));
    expect(blocos[0].tipo).toBe('titulo');
    expect(blocos.filter((bloco) => bloco.tipo === 'titulo')).toHaveLength(1);
    expect(blocos.filter((bloco) => bloco.tipo === 'secao').length).toBeGreaterThanOrEqual(8);
    // Tabela, negrito, link e bloco de código apareceriam crus no celular.
    expect(blocos.filter((bloco) => /\*\*|^\||```|\]\(/.test(bloco.texto))).toEqual([]);
  });
});
