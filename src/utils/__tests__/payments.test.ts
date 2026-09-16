import { descreverPagamento, diasDeAtraso, resumirPagamentos } from '@/utils/payments';

/** Instante local — os testes não dependem do fuso da máquina. */
function local(ano: number, mes: number, dia: number, hora = 10): string {
  return new Date(ano, mes - 1, dia, hora).toISOString();
}

const HOJE = new Date(2026, 8, 14, 15); // 14/09/2026 15h

describe('diasDeAtraso', () => {
  it('deveSerZeroQuandoPagoNoDiaDoVencimento', () => {
    // A regressão que isto trava: ler "2026-08-10" como UTC poria o
    // vencimento no dia 9 em São Paulo, e o pagamento do dia 10 viraria atraso.
    expect(diasDeAtraso({ due_date: '2026-08-10', paid_at: local(2026, 8, 10, 23) })).toBe(0);
  });

  it('deveSerZeroQuandoPagoAntesDoVencimento', () => {
    expect(diasDeAtraso({ due_date: '2026-08-10', paid_at: local(2026, 8, 6) })).toBe(0);
  });

  it('deveContarOsDiasAteOPagamento', () => {
    expect(diasDeAtraso({ due_date: '2026-08-10', paid_at: local(2026, 8, 15) })).toBe(5);
  });

  it('deveContarAteHojeQuandoAindaNaoFoiPago', () => {
    expect(diasDeAtraso({ due_date: '2026-08-10', paid_at: null }, HOJE)).toBe(35);
  });
});

describe('descreverPagamento', () => {
  it('deveDizerEmDiaQuandoNaoHouveAtraso', () => {
    expect(
      descreverPagamento({ due_date: '2026-08-10', paid_at: local(2026, 8, 8), status: 'paid' }),
    ).toBe('08/08/2026 · em dia');
  });

  it('deveUsarOSingularParaUmDia', () => {
    expect(
      descreverPagamento({ due_date: '2026-08-10', paid_at: local(2026, 8, 11), status: 'paid' }),
    ).toBe('11/08/2026 · 1 dia de atraso');
  });

  it('deveMostrarOAtrasoDeQuemAindaDeve', () => {
    expect(
      descreverPagamento({ due_date: '2026-08-10', paid_at: null, status: 'overdue' }, HOJE),
    ).toBe('Não pago · 35 dias de atraso');
  });

  it('naoDeveFalarEmAtrasoParaMensalidadeAindaNoPrazo', () => {
    expect(
      descreverPagamento({ due_date: '2026-09-20', paid_at: null, status: 'open' }, HOJE),
    ).toBe('Não pago');
  });
});

describe('resumirPagamentos', () => {
  it('deveContarCadaSituacao', () => {
    expect(
      resumirPagamentos([
        { status: 'paid' },
        { status: 'paid' },
        { status: 'overdue' },
        { status: 'open' },
        { status: 'pending_approval' },
      ]),
    ).toEqual({ pagas: 2, emAtraso: 1, emAberto: 1, emAnalise: 1 });
  });
});
