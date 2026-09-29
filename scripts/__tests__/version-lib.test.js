const fs = require('node:fs');
const path = require('node:path');

const {
  bumpVersion,
  buildChangelogSection,
  buildSupabaseWarning,
  buildVersionName,
  extractChangelogSection,
  insertChangelogSection,
  isSmallerThanSuggested,
  parseDescribe,
  parseVersion,
  suggestBump,
  supabaseChangesFrom,
  versionCodeFrom,
} = require('../version-lib');

const RAIZ = path.join(__dirname, '..', '..');
const lerJson = (arquivo) => JSON.parse(fs.readFileSync(path.join(RAIZ, arquivo), 'utf8'));

describe('bumpVersion', () => {
  it('deveSomarNoPatchSemMexerNoResto', () => {
    expect(bumpVersion('1.6.0', 'patch')).toBe('1.6.1');
  });

  it('deveZerarOPatchAoSubirOMinor', () => {
    expect(bumpVersion('1.6.3', 'minor')).toBe('1.7.0');
  });

  it('deveZerarMinorEPatchAoSubirOMajor', () => {
    expect(bumpVersion('1.6.3', 'major')).toBe('2.0.0');
  });

  it('deveAceitarOVDaTag', () => {
    expect(bumpVersion('v1.6.0', 'patch')).toBe('1.6.1');
  });
});

describe('versionCodeFrom', () => {
  it.each([
    ['1.6.0', 1006000],
    ['1.6.1', 1006001],
    ['1.7.0', 1007000],
    ['2.0.0', 2000000],
  ])('deveCalcular%sComo%i', (versao, codigo) => {
    expect(versionCodeFrom(versao)).toBe(codigo);
  });

  it('deveCrescerJuntoComAVersao', () => {
    // O Android só instala por cima quando o código cresce.
    const emOrdem = ['1.0.0', '1.2.4', '1.6.0', '1.6.1', '1.6.999', '1.7.0', '1.999.999', '2.0.0'];
    const codigos = emOrdem.map(versionCodeFrom);
    codigos.slice(1).forEach((codigo, i) => expect(codigo).toBeGreaterThan(codigos[i]));
  });

  it('deveRecusarParteQueNaoCabeNaFormula', () => {
    expect(() => versionCodeFrom('1.1000.0')).toThrow(/999/);
  });

  it.each(['1.6', 'abc', '1.6.0-beta'])('deveRecusarVersaoMalformada %s', (versao) => {
    expect(() => parseVersion(versao)).toThrow(/inválida/);
  });
});

describe('suggestBump', () => {
  it('deveSugerirMajorParaCommitComExclamacao', () => {
    expect(suggestBump([{ subject: 'feat(banco)!: recusa APK antigo' }])).toBe('major');
  });

  it('deveSugerirMajorParaBreakingChangeNoCorpo', () => {
    expect(suggestBump([{ subject: 'fix: troca rpc', body: 'BREAKING CHANGE: remove a antiga' }])).toBe(
      'major',
    );
  });

  it('deveSugerirMinorQuandoHaFuncionalidade', () => {
    expect(suggestBump([{ subject: 'fix: a' }, { subject: 'feat(chamada): b' }])).toBe('minor');
  });

  it('deveSugerirPatchSoComCorrecoesEDocs', () => {
    expect(suggestBump([{ subject: 'fix: a' }, { subject: 'docs: b' }, { subject: 'Merge branch x' }])).toBe(
      'patch',
    );
  });

  it('deveApontarQuandoAParteEscolhidaEMenorQueASugerida', () => {
    expect(isSmallerThanSuggested('patch', 'minor')).toBe(true);
    expect(isSmallerThanSuggested('major', 'minor')).toBe(false);
  });
});

describe('CHANGELOG', () => {
  const commits = [
    { subject: 'feat(chamada): guarda a chamada em andamento' },
    { subject: 'fix(teclado): campo nao fica sob o teclado' },
    { subject: 'perf: lista mais leve' },
    { subject: 'docs: runbook' },
    { subject: 'chore(deps): atualiza expo' },
    { subject: 'feat(banco)!: recusa APK anterior' },
  ];

  it('deveAgruparPorTipoEOmitirOsInternos', () => {
    const secao = buildChangelogSection({ version: '1.7.0', date: '2026-09-20', commits });

    expect(secao).toBe(
      [
        '## [1.7.0] - 2026-09-20',
        '',
        '### Quebra de compatibilidade',
        '',
        '- Recusa APK anterior',
        '',
        '### Novidades',
        '',
        '- Guarda a chamada em andamento',
        '',
        '### Correções',
        '',
        '- Campo nao fica sob o teclado',
        '- Lista mais leve',
        '',
      ].join('\n'),
    );
  });

  it('deveDizerQueNadaMudouParaQuemUsaQuandoSoHaCommitsInternos', () => {
    const secao = buildChangelogSection({ version: '1.6.1', date: '2026-09-20', commits: [commits[3]] });
    expect(secao).toContain('Sem mudanças visíveis');
  });

  it('deveInserirAVersaoNovaAcimaDaMaisRecente', () => {
    const atual = '# Changelog\n\nIntro.\n\n## [1.6.0] - 2026-09-14\n\n- A\n';
    const novo = insertChangelogSection(atual, '## [1.6.1] - 2026-09-20\n\n- B\n');
    expect(novo).toBe('# Changelog\n\nIntro.\n\n## [1.6.1] - 2026-09-20\n\n- B\n\n## [1.6.0] - 2026-09-14\n\n- A\n');
  });

  it('deveExtrairSoOTextoDaVersaoPedida', () => {
    const changelog = '# C\n\n## [1.6.1] - x\n\n- B\n\n## [1.6.0] - y\n\n- A\n';
    expect(extractChangelogSection(changelog, 'v1.6.0')).toBe('- A\n');
    expect(extractChangelogSection(changelog, '1.6.1')).toBe('- B\n');
    expect(extractChangelogSection(changelog, '9.9.9')).toBeNull();
  });

  it('deveDeixarDeForaAsNotasDeRodapeDepoisDaVersaoMaisAntiga', () => {
    const changelog = '# C\n\n## [1.0.0] - x\n\nPrimeira.\n\n---\n\n> Nota geral.\n';
    expect(extractChangelogSection(changelog, '1.0.0')).toBe('Primeira.\n');
  });
});

describe('buildVersionName', () => {
  const naTag = { tag: 'v1.6.0', commitsSinceTag: 0, sha: 'abc1234', dirty: false };
  const foraDaTag = { tag: 'v1.6.0', commitsSinceTag: 12, sha: 'abc1234', dirty: false };

  it('deveSerSoAVersaoNumBuildExatamenteNaTag', () => {
    expect(buildVersionName({ version: '1.6.0', describe: naTag, variant: 'prod' })).toBe('1.6.0');
  });

  it('deveLevarCommitsEShaForaDaTag', () => {
    expect(buildVersionName({ version: '1.6.0', describe: foraDaTag, variant: 'prod' })).toBe('1.6.0+12.abc1234');
  });

  it('deveMarcarOAppDevMesmoNaTag', () => {
    expect(buildVersionName({ version: '1.6.0', describe: naTag, variant: 'dev' })).toBe('1.6.0+dev.0.abc1234');
    expect(buildVersionName({ version: '1.6.0', describe: foraDaTag, variant: 'dev' })).toBe(
      '1.6.0+dev.12.abc1234',
    );
  });

  it('deveAvisarQuandoHaAlteracaoNaoCommitada', () => {
    const sujo = { ...naTag, dirty: true };
    expect(buildVersionName({ version: '1.6.0', describe: sujo, variant: 'prod' })).toBe('1.6.0+0.abc1234.dirty');
  });

  it('deveCairNaVersaoPuraSemGit', () => {
    expect(buildVersionName({ version: '1.6.0', describe: null, variant: 'prod' })).toBe('1.6.0');
    expect(buildVersionName({ version: '1.6.0', describe: null, variant: 'dev' })).toBe('1.6.0+dev');
  });

  it('deveLerASaidaDoGitDescribe', () => {
    expect(parseDescribe('v1.6.0-18-gc03dc6d-dirty\n')).toEqual({
      tag: 'v1.6.0',
      commitsSinceTag: 18,
      sha: 'c03dc6d',
      dirty: true,
    });
    expect(parseDescribe('fatal: No names found')).toBeNull();
  });
});

describe('supabaseChangesFrom', () => {
  it('deveVoltarVazioQuandoNadaMudouEmSupabase', () => {
    expect(supabaseChangesFrom(['', 'src/App.tsx', 'README.md'])).toEqual({ migrations: [], functions: [] });
  });

  it('deveListarAsMigrationsPeloNomeDoArquivo', () => {
    expect(
      supabaseChangesFrom([
        'supabase/migrations/20260923100000_aluno_sem_app.sql',
        'supabase/migrations/20260922100000_promocao_so_de_professor.sql',
      ]).migrations,
    ).toEqual(['20260922100000_promocao_so_de_professor.sql', '20260923100000_aluno_sem_app.sql']);
  });

  it('deveListarCadaFuncaoUmaVezSoPeloNomeDaPasta', () => {
    expect(
      supabaseChangesFrom([
        'supabase/functions/create-student/index.ts',
        'supabase/functions/create-student/validacao.ts',
        'supabase/functions/_shared/cors.ts',
      ]).functions,
    ).toEqual(['_shared', 'create-student']);
  });

  it('deveIgnorarSeedTestesEArquivoSoltoNaRaizDeFunctions', () => {
    expect(
      supabaseChangesFrom([
        'supabase/seed/historico_demonstracao.sql',
        'supabase/tests/regressao_rls.sql',
        'supabase/functions/deno.json',
        'supabase/migrations/LEIAME.md',
      ]),
    ).toEqual({ migrations: [], functions: [] });
  });

  it('deveAceitarCaminhoComBarraInvertida', () => {
    expect(supabaseChangesFrom(['supabase\\functions\\send-push\\index.ts']).functions).toEqual(['send-push']);
  });
});

describe('buildSupabaseWarning', () => {
  it('deveNaoAvisarQuandoNaoHaNadaParaPublicar', () => {
    expect(buildSupabaseWarning({ baseTag: 'v1.8.0', changes: { migrations: [], functions: [] } })).toBeNull();
  });

  it('deveLembrarDePublicarEmProducaoAntesDaApkComCadaItem', () => {
    const aviso = buildSupabaseWarning({
      baseTag: 'v1.7.0',
      changes: { migrations: ['20260923100000_aluno_sem_app.sql'], functions: ['_shared', 'create-student'] },
    });

    expect(aviso).toContain('desde v1.7.0');
    expect(aviso).toContain('Publique em produção antes da APK');
    expect(aviso).toContain('- 20260923100000_aluno_sem_app.sql');
    expect(aviso).toContain('- create-student');
    expect(aviso).toContain('- _shared (todas as funções que o usam)');
    expect(aviso).toContain('migration → Edge Function → só então a APK');
  });

  it('deveOmitirOBlocoDeMigrationsQuandoSoAFuncaoMudou', () => {
    const aviso = buildSupabaseWarning({ baseTag: 'v1.8.0', changes: { migrations: [], functions: ['send-push'] } });

    expect(aviso).not.toContain('Migrations');
    expect(aviso).toContain('- send-push');
  });
});

describe('versão no repositório', () => {
  it('deveTerVersionCodeDerivadoDaVersaoEPackageJsonAlinhado', () => {
    // Barra edição à mão: a versão muda só por `npm run versao:*`.
    const { expo } = lerJson('app.json');
    const pacote = lerJson('package.json');
    const trava = lerJson('package-lock.json');

    expect(expo.android.versionCode).toBe(versionCodeFrom(expo.version));
    expect(pacote.version).toBe(expo.version);
    expect(trava.version).toBe(expo.version);
    expect(trava.packages[''].version).toBe(expo.version);
  });
});
