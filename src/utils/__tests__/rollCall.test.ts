import {
  alternarMarcacao,
  contarMarcacoes,
  houveAlteracao,
  montarEnvioDaChamada,
} from '@/utils/rollCall';

const ALUNOS = ['ana', 'bruno', 'carla'];

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

describe('contarMarcacoes', () => {
  it('deveContarCadaSituacaoIncluindoQuemNaoEstaNoMapa', () => {
    expect(contarMarcacoes(ALUNOS, { ana: 'present', bruno: null })).toEqual({
      presentes: 1,
      ausentes: 0,
      semMarcacao: 2,
    });
  });
});

describe('montarEnvioDaChamada', () => {
  it('deveMandarQuemFicouSemMarcacaoComoFalta', () => {
    // Na conta de frequência, aula concluída sem presença já é falta; gravar
    // explícito evita um "sem marcação" que engana quem reabre a chamada.
    expect(montarEnvioDaChamada(ALUNOS, { ana: 'present', bruno: 'absent' })).toEqual({
      presentes: ['ana'],
      ausentes: ['bruno', 'carla'],
    });
  });
});

describe('houveAlteracao', () => {
  it('naoDeveAcusarAlteracaoQuandoATelaEspelhaOGravado', () => {
    expect(houveAlteracao(ALUNOS, { ana: 'present' }, { ana: 'present' })).toBe(false);
  });

  it('deveTratarNuloEAusenteNoMapaComoAMesmaCoisa', () => {
    expect(houveAlteracao(ALUNOS, { bruno: null }, {})).toBe(false);
  });

  it('deveAcusarAlteracaoAoDesmarcarAlgoGravado', () => {
    expect(houveAlteracao(ALUNOS, { ana: null }, { ana: 'present' })).toBe(true);
  });
});
