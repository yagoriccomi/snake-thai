const fs = require('node:fs');
const path = require('node:path');

const { injetarAssinatura, MENSAGEM_DA_TRAVA } = require('../withReleaseSigning');

// Trecho sintético do app/build.gradle do template do Expo.
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'fixtures', 'build.gradle.template.txt'), 'utf8');

const contar = (texto, trecho) => texto.split(trecho).length - 1;

describe('injetarAssinatura', () => {
  it('deveInjetarOSigningConfigReleaseUmaUnicaVezQuandoChamadoDuasVezes', () => {
    const umaVez = injetarAssinatura(TEMPLATE);
    const duasVezes = injetarAssinatura(umaVez);

    expect(duasVezes).toBe(umaVez);
    expect(contar(duasVezes, 'storeFile file(SNAKETHAI_RELEASE_STORE_FILE)')).toBe(1);
    expect(contar(duasVezes, 'gradle.taskGraph.whenReady')).toBe(1);
  });

  it('deveColocarOReleaseDentroDoSigningConfigs', () => {
    const resultado = injetarAssinatura(TEMPLATE);
    const inicio = resultado.indexOf('signingConfigs {');
    const fim = resultado.indexOf('buildTypes {');

    expect(resultado.slice(inicio, fim)).toContain('release {');
  });

  it('deveTrocarSoASignaturaDoBuildTypeReleaseEPreservarADoDebug', () => {
    const resultado = injetarAssinatura(TEMPLATE);
    const buildTypes = resultado.slice(resultado.indexOf('buildTypes {'));
    const [debug, release] = buildTypes.split('release {');

    expect(debug).toContain('signingConfig signingConfigs.debug');
    expect(release).toContain(
      "signingConfig project.hasProperty('SNAKETHAI_RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
  });

  it('deveAcrescentarATravaDeReleaseSemKeystoreNoFim', () => {
    const resultado = injetarAssinatura(TEMPLATE, { exigirChaveDeProducao: true });
    const trava = resultado.slice(resultado.indexOf('gradle.taskGraph.whenReady'));

    expect(resultado.indexOf('gradle.taskGraph.whenReady')).toBeGreaterThan(resultado.indexOf('dependencies {'));
    expect(trava).toContain("tarefa.name == 'packageRelease'");
    expect(trava).toContain("tarefa.name == 'signReleaseBundle'");
    expect(trava).toContain(MENSAGEM_DA_TRAVA);
    // A mensagem aparece no log do build: é texto fixo, sem o caminho da chave nem senha.
    expect(MENSAGEM_DA_TRAVA).not.toMatch(/\$\{|\.p12|\.keystore|USERPROFILE|[A-Z]:\\|PASSWORD=/);
    expect(trava).not.toMatch(/throw new GradleException\([^)]*keystore\s*\+/);
  });

  it('naoDeveAlterarOBuildGradleDoAppDev', () => {
    expect(injetarAssinatura(TEMPLATE, { exigirChaveDeProducao: false })).toBe(TEMPLATE);
  });

  it('deveExigirAChaveQuandoNenhumaOpcaoEInformada', () => {
    expect(injetarAssinatura(TEMPLATE)).toContain(MENSAGEM_DA_TRAVA);
  });

  it('deveFalharClaramenteQuandoOTemplateMudou', () => {
    expect(() => injetarAssinatura(TEMPLATE.replace("keyPassword 'android'", 'keyPassword x'))).toThrow(
      /âncora do signingConfigs/,
    );
    expect(() => injetarAssinatura(TEMPLATE.replace(/buildTypes \{[\s\S]*$/, ''))).toThrow(/buildTypes\.release/);
  });
});
