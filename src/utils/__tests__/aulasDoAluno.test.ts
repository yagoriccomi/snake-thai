import { aulaDoAluno } from '@/test-utils/aulaDoAluno';
import {
  acaoDaAula,
  detalheDaAula,
  resumoDaSemana,
  segundaDaSemana,
  seloDaAula,
  textoAcimaDaCota,
} from '@/utils/aulasDoAluno';

const ANTES = new Date('2030-03-12T10:00:00.000Z');
const DEPOIS = new Date('2030-03-13T10:00:00.000Z');

describe('acaoDaAula (contrato § 12.2)', () => {
  it('deveOferecerVouAoLivreEDesmarcarQuandoJaMarcou', () => {
    expect(acaoDaAula(aulaDoAluno(), ANTES)).toBe('vou');
    expect(acaoDaAula(aulaDoAluno({ declared_status: 'present', origem: 'marcou' }), ANTES)).toBe('desmarcar');
  });

  it('naoDeveOferecerNadaAoLivreEmAulaSoDeFixos', () => {
    expect(acaoDaAula(aulaDoAluno({ audience: 'fixed' }), ANTES)).toBe('nenhuma');
  });

  it('deveOferecerVouENaoVouAoFixoNasAulasDaGrade', () => {
    for (const origem of ['turma', 'permanente', 'troca'] as const) {
      expect(acaoDaAula(aulaDoAluno({ schedule_mode: 'fixed', origem }), ANTES)).toBe('vou-nao-vou');
    }
  });

  it('deveOferecerVouExtraSoQuandoOBancoPermite', () => {
    expect(acaoDaAula(aulaDoAluno({ schedule_mode: 'fixed', can_mark_extra: true }), ANTES)).toBe('vou-extra');
    expect(acaoDaAula(aulaDoAluno({ schedule_mode: 'fixed', can_mark_extra: false }), ANTES)).toBe('nenhuma');
    expect(acaoDaAula(aulaDoAluno({ schedule_mode: 'fixed', origem: 'extra', declared_status: 'present' }), ANTES)).toBe(
      'desmarcar-extra',
    );
  });

  it('deveTratarOEventoDoFixoComoOdeQualquerAluno', () => {
    expect(acaoDaAula(aulaDoAluno({ schedule_mode: 'fixed', type: 'event' }), ANTES)).toBe('vou');
  });

  it('naoDeveOferecerNadaNaAulaCanceladaNemNaQueJaComecou', () => {
    expect(acaoDaAula(aulaDoAluno({ cancelled: true }), ANTES)).toBe('nenhuma');
    expect(acaoDaAula(aulaDoAluno(), DEPOIS)).toBe('nenhuma');
  });
});

describe('seloDaAula e detalheDaAula (contrato § 3)', () => {
  it('deveUsarOsRotulosDoContrato', () => {
    expect(seloDaAula(aulaDoAluno({ cancelled: true }), false)).toEqual({ texto: 'Cancelada', tom: 'erro' });
    expect(seloDaAula(aulaDoAluno({ schedule_mode: 'fixed', origem: 'turma' }), true)?.texto).toBe('Sua aula');
    expect(seloDaAula(aulaDoAluno({ schedule_mode: 'fixed', origem: 'turma' }), false)).toBeNull();
    expect(seloDaAula(aulaDoAluno({ origem: 'permanente' }), false)?.texto).toBe('Troca permanente');
    expect(seloDaAula(aulaDoAluno({ origem: 'troca_pendente' }), false)?.texto).toBe('Troca pendente');
    expect(seloDaAula(aulaDoAluno({ origem: 'extra' }), false)?.texto).toBe('Extra');
    expect(seloDaAula(aulaDoAluno({ origem: 'marcou' }), false)?.texto).toBe('Marcada');
  });

  it('deveDescreverAsTrocasComDiaEHora', () => {
    const outra = '2030-03-14T22:00:00.000Z';
    expect(detalheDaAula(aulaDoAluno({ origem: 'trocou', swap_other_date_time: outra }))).toMatch(/^Trocou para \w{3} 14\/03 /);
    expect(detalheDaAula(aulaDoAluno({ origem: 'troca', swap_other_date_time: outra }))).toMatch(/^no lugar de /);
    expect(
      detalheDaAula(aulaDoAluno({ swap_role: 'origem', swap_status: 'pending', swap_other_date_time: outra })),
    ).toMatch(/^Troca pendente para /);
    expect(detalheDaAula(aulaDoAluno({ swap_role: 'destino', swap_status: 'expired' }))).toBe(
      'Troca expirada · vale a aula original',
    );
  });

  it('deveDizerQueAAulaCanceladaDoFixoEAbonada', () => {
    expect(detalheDaAula(aulaDoAluno({ schedule_mode: 'fixed', origem: 'turma', cancelled: true }))).toBe(
      'Aula abonada: não conta no seu mês',
    );
  });
});

describe('resumoDaSemana', () => {
  it('deveContarFeitasEMarcadasSoEmAulaDeRotinaNaoCancelada', () => {
    const resumo = resumoDaSemana([
      aulaDoAluno({ status: 'present' }),
      aulaDoAluno({ declared_status: 'present' }),
      aulaDoAluno({ declared_status: 'present', cancelled: true }),
      aulaDoAluno({ declared_status: 'present', type: 'event' }),
    ]);
    expect(resumo).toEqual({ modo: 'free', alvo: 3, feitas: 1, marcadas: 1 });
  });

  it('deveDevolverNuloSemAulas', () => {
    expect(resumoDaSemana([])).toBeNull();
  });
});

describe('textos e datas', () => {
  it('deveMontarOAvisoDeCotaDoContrato', () => {
    expect(textoAcimaDaCota(4, 3)).toBe(
      'Você marcou 4 aulas nesta semana e seu plano é 3x. Pode ir: fica registrado acima do plano.',
    );
  });

  it('deveAcharASegundaDaSemanaInclusiveNoDomingo', () => {
    // 15/03/2030 é sexta; 17/03/2030 é domingo: os dois são da semana de 11/03.
    expect(segundaDaSemana(new Date(2030, 2, 15)).getDate()).toBe(11);
    expect(segundaDaSemana(new Date(2030, 2, 17)).getDate()).toBe(11);
  });
});
