import { alternarMarcacao } from '@/utils/rollCall';

describe('alternarMarcacao', () => {
  it('deveMarcarOSimboloTocado', () => {
    expect(alternarMarcacao(null, 'present')).toBe('present');
  });

  it('deveTrocarQuandoOOutroSimboloEstavaMarcado', () => {
    expect(alternarMarcacao('present', 'absent')).toBe('absent');
  });

  it('deveDesmarcarAoTocarDeNovoNoMesmo', () => {
    expect(alternarMarcacao('absent', 'absent')).toBeNull();
  });
});
