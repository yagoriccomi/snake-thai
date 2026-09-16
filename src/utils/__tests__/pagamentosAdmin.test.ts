import { currentMonthIso } from '@/utils/datetime';
import {
  situacaoDoMes,
  situacaoSemPagamento,
  situacoesPorMes,
  temComprovante,
} from '@/utils/payments';

const HOJE = new Date(2026, 8, 14, 15); // 14/09/2026 15h

describe('temComprovante', () => {
  const SEM = { proof_public_id: null, proof_storage_path: null, proof_url: null };

  it('deveReconhecerOAnexoDaCloudinary', () => {
    expect(temComprovante({ ...SEM, proof_public_id: 'comprovantes/a/b' })).toBe(true);
  });

  it('deveReconhecerOAnexoLegado', () => {
    // Comprovante antigo só com URL: não dizer "sem anexo" para ele.
    expect(temComprovante({ ...SEM, proof_url: 'https://x/y.jpg' })).toBe(true);
  });

  it('deveDizerQueNaoTemQuandoNadaFoiAnexado', () => {
    expect(temComprovante(SEM)).toBe(false);
  });
});

describe('situacaoSemPagamento', () => {
  it('deveVoltarParaVencidaQuandoOVencimentoPassou', () => {
    expect(situacaoSemPagamento('2026-09-10', HOJE)).toBe('overdue');
  });

  it('deveVoltarParaEmAbertoNoProprioDiaDoVencimento', () => {
    expect(situacaoSemPagamento('2026-09-14', HOJE)).toBe('open');
  });

  it('deveVoltarParaEmAbertoAntesDoVencimento', () => {
    expect(situacaoSemPagamento('2026-10-10', HOJE)).toBe('open');
  });
});

describe('situacaoDoMes', () => {
  it('deveDestacarOAtrasoAcimaDeTudo', () => {
    expect(situacaoDoMes(['paid', 'open', 'overdue', 'pending_approval'])).toBe('overdue');
  });

  it('deveDestacarOQueAguardaOAdminAntesDoQueEstaEmAberto', () => {
    expect(situacaoDoMes(['paid', 'open', 'pending_approval'])).toBe('pending_approval');
  });

  it('deveSerNuloSemMensalidades', () => {
    expect(situacaoDoMes([])).toBeNull();
  });
});

describe('situacoesPorMes', () => {
  it('deveOrdenarDoMaisRecenteEIncluirOMesCorrenteMesmoVazio', () => {
    expect(
      situacoesPorMes(
        [
          { reference_month: '2026-07-01', status: 'paid' },
          { reference_month: '2026-08-01', status: 'paid' },
          { reference_month: '2026-08-01', status: 'overdue' },
        ],
        ['2026-09-01'],
      ),
    ).toEqual([
      { referenceMonth: '2026-09-01', situacao: null },
      { referenceMonth: '2026-08-01', situacao: 'overdue' },
      { referenceMonth: '2026-07-01', situacao: 'paid' },
    ]);
  });
});

describe('currentMonthIso', () => {
  it('deveUsarOPrimeiroDiaDoMesDoAparelho', () => {
    expect(currentMonthIso(HOJE)).toBe('2026-09-01');
  });
});
