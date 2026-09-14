import { createQueryChain, RLS_DENIED } from '@/test-utils/supabaseMock';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]): unknown => mockFrom(...args),
  },
}));

// O serviço de comprovantes carrega o cliente da API; aqui não é exercitado.
jest.mock('@/services/proofs.service', () => ({
  removerArquivoDoComprovante: jest.fn(),
  submitProof: jest.fn(),
  createSignedProofUrl: jest.fn(),
}));

import {
  fetchPaymentMonthsOverview,
  fetchPaymentsForMonth,
  markPaymentAsUnpaid,
} from '@/services/payments.service';

const HOJE = new Date(2026, 8, 14, 15);

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchPaymentsForMonth', () => {
  it('deveFiltrarPelaCompetencia', async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await fetchPaymentsForMonth('2026-08-01');

    expect(mockFrom).toHaveBeenCalledWith('payments');
    expect(chain.eq).toHaveBeenCalledWith('reference_month', '2026-08-01');
  });
});

describe('fetchPaymentMonthsOverview', () => {
  it('deveTrazerSoCompetenciaESituacao', async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await fetchPaymentMonthsOverview();

    // Só as duas colunas: o seletor não precisa de valores nem de comprovantes.
    expect(chain.select).toHaveBeenCalledWith('reference_month, status');
  });
});

describe('markPaymentAsUnpaid', () => {
  it('deveVoltarParaVencidaQuandoOVencimentoJaPassou', async () => {
    const chain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await markPaymentAsUnpaid({ id: 'pag-1', due_date: '2026-08-10' }, HOJE);

    // paid_at junto: a constraint exige (status = paid) = (paid_at not null).
    expect(chain.update).toHaveBeenCalledWith({ status: 'overdue', paid_at: null });
    expect(chain.eq).toHaveBeenCalledWith('id', 'pag-1');
  });

  it('deveVoltarParaEmAbertoQuandoAindaNaoVenceu', async () => {
    const chain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await markPaymentAsUnpaid({ id: 'pag-1', due_date: '2026-10-10' }, HOJE);

    expect(chain.update).toHaveBeenCalledWith({ status: 'open', paid_at: null });
  });

  it('naoDeveApagarOComprovante', async () => {
    const chain = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await markPaymentAsUnpaid({ id: 'pag-1', due_date: '2026-08-10' }, HOJE);

    const [payload] = chain.update.mock.calls[0] as [Record<string, unknown>];
    expect(payload).not.toHaveProperty('proof_public_id');
    expect(payload).not.toHaveProperty('proof_provider');
  });

  it('devePropagarARecusaDoBanco', async () => {
    mockFrom.mockReturnValue(createQueryChain(RLS_DENIED));
    await expect(
      markPaymentAsUnpaid({ id: 'pag-1', due_date: '2026-08-10' }, HOJE),
    ).rejects.toEqual(RLS_DENIED.error);
  });
});
