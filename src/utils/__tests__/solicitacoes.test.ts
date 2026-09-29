import { dentroDoPrazoDoPedido, pedidosDoProfessor } from '@/utils/solicitacoes';

const AULA = new Date(2030, 2, 10, 19, 0);
const DEPOIS = new Date(2030, 2, 11, 9, 0);
const BASE = { escalado: true, cancelada: false, concluida: true, minhaPresenca: false, dataDaAula: AULA };

describe('pedidosDoProfessor (§ 9.3)', () => {
  it('deveOferecerEuEstavaEJustificarAoEscaladoMarcadoAusente', () => {
    expect(pedidosDoProfessor(BASE, DEPOIS)).toEqual(['teacher_was_present', 'teacher_absence']);
  });

  it('naoDeveOferecerNadaAoEscaladoPresente', () => {
    expect(pedidosDoProfessor({ ...BASE, minhaPresenca: true }, DEPOIS)).toEqual([]);
  });

  it('deveDeixarJustificarAntesDaChamada', () => {
    expect(pedidosDoProfessor({ ...BASE, concluida: false, minhaPresenca: null }, DEPOIS)).toEqual(['teacher_absence']);
  });

  it('deveOferecerCorrigirEIncluirAQuemEstaDeFora', () => {
    expect(pedidosDoProfessor({ ...BASE, escalado: false, minhaPresenca: null }, DEPOIS)).toEqual([
      'teacher_asks_edit',
      'teacher_asks_inclusion',
    ]);
  });

  it('naoDeveOferecerIncluirAntesDaAula', () => {
    expect(
      pedidosDoProfessor({ ...BASE, escalado: false, concluida: false, minhaPresenca: null }, new Date(2030, 2, 10, 8)),
    ).toEqual([]);
  });

  it('naoDeveOferecerNadaNaAulaCanceladaNemForaDoPrazo', () => {
    expect(pedidosDoProfessor({ ...BASE, cancelada: true }, DEPOIS)).toEqual([]);
    expect(pedidosDoProfessor(BASE, new Date(2030, 2, 18, 0, 1))).toEqual([]);
  });
});

describe('dentroDoPrazoDoPedido (T19)', () => {
  it('deveValerAteOFimDoSetimoDia', () => {
    expect(dentroDoPrazoDoPedido(AULA, new Date(2030, 2, 17, 23, 59))).toBe(true);
    expect(dentroDoPrazoDoPedido(AULA, new Date(2030, 2, 18, 0, 0))).toBe(false);
  });
});
