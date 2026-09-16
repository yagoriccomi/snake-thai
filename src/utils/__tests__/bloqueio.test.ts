import { deveBloquearAoVoltar, TEMPO_MAXIMO_EM_SEGUNDO_PLANO_MS } from '@/utils/bloqueio';

const SAIU = 1_000_000;
const MINUTO = 60_000;

describe('deveBloquearAoVoltar', () => {
  it('naoDeveBloquearQuemVoltaDaGaleriaEmSegundos', () => {
    // O caso que motivou a regra: anexar comprovante leva o app ao segundo plano.
    expect(deveBloquearAoVoltar(SAIU, SAIU + 20_000)).toBe(false);
  });

  it('naoDeveBloquearExatamenteNosDezMinutos', () => {
    expect(deveBloquearAoVoltar(SAIU, SAIU + TEMPO_MAXIMO_EM_SEGUNDO_PLANO_MS)).toBe(false);
  });

  it('deveBloquearDepoisDeDezMinutosFora', () => {
    expect(deveBloquearAoVoltar(SAIU, SAIU + 10 * MINUTO + 1)).toBe(true);
  });

  it('naoDeveBloquearQuandoNaoHouveSaida', () => {
    expect(deveBloquearAoVoltar(null, SAIU)).toBe(false);
  });
});
