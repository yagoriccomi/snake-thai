import { createQueryChain, RLS_DENIED, type QueryChainMock } from '@/test-utils/supabaseMock';

const mockFrom = jest.fn();
const mockRemoverArquivo = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]): unknown => mockFrom(...args),
  },
}));

jest.mock('@/services/proofs.service', () => ({
  removerArquivoDoComprovante: (...args: unknown[]): unknown => mockRemoverArquivo(...args),
  submitProof: jest.fn(),
  createSignedProofUrl: jest.fn(),
}));

import { approvePayment, rejectPayment } from '@/services/payments.service';

const PAGAMENTO = 'a8fed606-d184-4eb3-80ac-f657c9728461';

function mockQuery(resultado: Parameters<typeof createQueryChain>[0]): QueryChainMock {
  const chain = createQueryChain(resultado);
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRemoverArquivo.mockReset();
});

describe('approvePayment', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deveGravarPaidAtJuntoComOStatusParaSatisfazerAConstraint', async () => {
    const chain = mockQuery({ data: null, error: null });
    await approvePayment(PAGAMENTO);
    // Regressão: só `{ status: 'paid' }` violava payments_paid_at_matches_status,
    // e TODA aprovação falhava no banco.
    expect(chain.update).toHaveBeenCalledWith({
      status: 'paid',
      paid_at: '2026-09-14T15:00:00.000Z',
    });
    expect(chain.eq).toHaveBeenCalledWith('id', PAGAMENTO);
  });

  it('devePropagarARecusaDoBanco', async () => {
    mockQuery(RLS_DENIED);
    await expect(approvePayment(PAGAMENTO)).rejects.toEqual(RLS_DENIED.error);
  });
});

describe('rejectPayment', () => {
  it('deveLimparPaidAtAoReabrirACobranca', async () => {
    mockRemoverArquivo.mockResolvedValue(undefined);
    const chain = mockQuery({ data: null, error: null });
    await rejectPayment({
      id: PAGAMENTO,
      proof_provider: 'cloudinary',
      proof_public_id: 'comprovantes/x/y',
      proof_storage_path: null,
      proof_url: null,
    });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'open', paid_at: null, proof_public_id: null }),
    );
  });
});
