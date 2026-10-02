const {
  gerarCredenciais,
  montarConteudoQr,
  desenharQr,
  acharServico,
  lerResultadoPareamento,
  jaConectado,
} = require('../parear-adb-qr');

const MDNS = [
  'List of discovered mdns services',
  'adb-R58M1234-AbCdEf\t_adb-tls-connect._tcp\t192.168.15.120:41234',
  'snake-abc123\t_adb-tls-pairing._tcp\t192.168.15.120:37123',
  '',
].join('\r\n');

describe('gerarCredenciais', () => {
  it('deveGerarNomeESenhaSoComLetrasMinusculasENumeros', () => {
    const { nome, senha } = gerarCredenciais();
    expect(nome).toMatch(/^snake-[a-z0-9]{10}$/);
    expect(senha).toMatch(/^[a-z0-9]{12}$/);
  });

  it('deveGerarCredenciaisDiferentesACadaPareamento', () => {
    expect(gerarCredenciais()).not.toEqual(gerarCredenciais());
  });
});

describe('montarConteudoQr', () => {
  it('deveUsarOFormatoQueATelaDePareamentoDoAndroidLe', () => {
    expect(montarConteudoQr({ nome: 'snake-x', senha: 'y' })).toBe('WIFI:T:ADB;S:snake-x;P:y;;');
  });
});

describe('desenharQr', () => {
  it('deveJuntarDuasLinhasDeModulosEmCadaLinhaDoTerminalComMargem', () => {
    // 2x2: escuro só em cima à esquerda e embaixo à direita.
    const linhas = desenharQr(Uint8Array.from([1, 0, 0, 1])).split('\n');
    // 2 módulos + 4 de margem de cada lado = 10 linhas de módulos = 5 do terminal.
    expect(linhas).toHaveLength(5);
    const meio = linhas[2].replace(/\x1b\[[0-9;]*m/g, '');
    expect(meio).toBe(`  ${' '.repeat(4)}▀▄${' '.repeat(4)}`);
  });

  it('deveFixarPretoNoBrancoPorqueOLeitorNaoLeQrInvertido', () => {
    expect(desenharQr(Uint8Array.from([1]))).toContain('\x1b[30;107m');
  });
});

describe('acharServico', () => {
  it('deveDevolverOEnderecoDoServicoDePareamentoComONomeDoQr', () => {
    expect(acharServico(MDNS, { nome: 'snake-abc123', tipo: '_adb-tls-pairing' })).toBe(
      '192.168.15.120:37123',
    );
  });

  it('deveIgnorarServicoDeOutroNomeOuDeOutroTipo', () => {
    expect(acharServico(MDNS, { nome: 'snake-outro', tipo: '_adb-tls-pairing' })).toBeNull();
    expect(acharServico(MDNS, { nome: 'snake-abc123', tipo: '_adb-tls-connect' })).toBeNull();
  });

  it('deveAcharOServicoDeConexaoPeloGuidDoPareamento', () => {
    expect(acharServico(MDNS, { nome: 'adb-R58M1234-AbCdEf', tipo: '_adb-tls-connect' })).toBe(
      '192.168.15.120:41234',
    );
  });
});

describe('lerResultadoPareamento', () => {
  it('deveReconhecerSucessoELerOGuid', () => {
    const saida = 'Successfully paired to 192.168.15.120:37123 [guid=adb-R58M1234-AbCdEf]\n';
    expect(lerResultadoPareamento(saida)).toEqual({ pareou: true, guid: 'adb-R58M1234-AbCdEf' });
  });

  it('deveReconhecerFalhaSemInventarGuid', () => {
    expect(lerResultadoPareamento('Failed: Unable to start pairing client.\n')).toEqual({
      pareou: false,
      guid: null,
    });
  });
});

describe('jaConectado', () => {
  const GUID = 'adb-R58M1234-AbCdEf';

  it('deveReconhecerAConexaoAutomaticaDoAdb', () => {
    const saida = `List of devices attached\r\n${GUID}._adb-tls-connect._tcp\tdevice\r\n`;
    expect(jaConectado(saida, GUID)).toBe(true);
  });

  it('naoDeveContarAparelhoOfflineOuDeOutroGuid', () => {
    expect(jaConectado(`${GUID}._adb-tls-connect._tcp\toffline\n`, GUID)).toBe(false);
    expect(jaConectado('adb-OUTRO._adb-tls-connect._tcp\tdevice\n', GUID)).toBe(false);
  });
});
