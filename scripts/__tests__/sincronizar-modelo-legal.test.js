const fs = require('fs');
const path = require('path');

const {
  chavesDoModelo,
  delimitadorLivre,
  montarMigration,
  nomeDaMigration,
  problemasDoModelo,
} = require('../sincronizar-modelo-legal');

const { CAMPOS_LEGAIS } = require('@/constants/legalFields');

describe('problemasDoModelo', () => {
  it('deveAceitarTextoComMarcadoresNomeados', () => {
    expect(problemasDoModelo('# Termos\n\nCNPJ {{cnpj}} e foro {{foro}}.')).toEqual([]);
  });

  it('deveRecusarORascunhoAntigo', () => {
    const problemas = problemasDoModelo('CNPJ [PREENCHER: CNPJ]');
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('{{chave}}');
  });

  it('deveRecusarMarcadorForaDoFormato', () => {
    expect(problemasDoModelo('CNPJ {{ cnpj }}')).toHaveLength(1);
    expect(problemasDoModelo('CNPJ {{CNPJ}}')).toHaveLength(1);
  });

  it('deveRecusarModeloVazio', () => {
    expect(problemasDoModelo('   ')).toEqual(['O documento está vazio.']);
  });
});

describe('montarMigration', () => {
  it('deveGravarOTextoLiteralEAtualizarOModeloExistente', () => {
    const sql = montarMigration({ tipo: 'terms_of_use', conteudo: "Academia D'Ávila {{cnpj}}\r\n" });

    expect(sql).toContain("insert into public.legal_templates (kind, body)");
    expect(sql).toContain("values ('terms_of_use', $modelo$Academia D'Ávila {{cnpj}}\n$modelo$)");
    expect(sql).toContain('on conflict (kind) do update set body = excluded.body');
  });

  it('deveTrocarODelimitadorQuandoEleApareceNoTexto', () => {
    expect(delimitadorLivre('custa $modelo$ e $modelo1$')).toBe('$modelo2$');
  });

  it('deveUsarCarimboUtcNoNome', () => {
    const agora = new Date(Date.UTC(2026, 8, 18, 21, 1, 0));
    expect(nomeDaMigration('privacy_policy', agora)).toBe('20260918210100_modelo_privacy_policy.sql');
  });
});

describe('modelos em docs/legal', () => {
  const ler = (arquivo) => fs.readFileSync(path.join(__dirname, '../../docs/legal', arquivo), 'utf8');

  it.each(['POLITICA-DE-PRIVACIDADE.md', 'TERMOS-DE-USO.md'])('deveEstarProntoParaVirarModelo %s', (arquivo) => {
    expect(problemasDoModelo(ler(arquivo))).toEqual([]);
  });

  it('deveTerNaTelaTodoMarcadorUsadoNosDocumentos', () => {
    // Marcador sem campo na tela = lacuna que ninguém consegue preencher, e a
    // publicação fica travada sem explicação.
    const usados = new Set([
      ...chavesDoModelo(ler('POLITICA-DE-PRIVACIDADE.md')),
      ...chavesDoModelo(ler('TERMOS-DE-USO.md')),
    ]);
    const naTela = new Set(CAMPOS_LEGAIS.map((campo) => campo.id));

    expect([...usados].filter((chave) => !naTela.has(chave))).toEqual([]);
    expect([...naTela].filter((chave) => !usados.has(chave))).toEqual([]);
  });
});
