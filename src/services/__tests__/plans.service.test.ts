import {
  createQueryChain,
  NETWORK_FAILURE,
  RLS_DENIED,
  type QueryChainMock,
} from '@/test-utils/supabaseMock';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]): unknown => mockFrom(...args),
  },
}));

import {
  createPlan,
  deactivatePlan,
  fetchPlans,
  updatePlan,
  type PlanInput,
} from '@/services/plans.service';

/** Plano de exemplo no formato exato que o banco devolve. */
const PLANO = {
  id: 'plan-1',
  name: 'Mensal 3x',
  description: null,
  price_cents: 12990,
  billing_period: 'monthly' as const,
  due_day: 10,
  is_active: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

/** Entrada válida de domínio, com o preço já em centavos. */
const ENTRADA: PlanInput = {
  name: '  Mensal 3x  ',
  description: '  treino três vezes por semana  ',
  priceCents: 12990,
  billingPeriod: 'monthly',
  dueDay: 10,
  isActive: true,
};

function mockQuery(resultado: Parameters<typeof createQueryChain>[0]): QueryChainMock {
  const chain = createQueryChain(resultado);
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchPlans', () => {
  it('devePropagarOErroQuandoAConsultaFalha', async () => {
    mockQuery(NETWORK_FAILURE);
    // Devolver [] aqui faria a tela dizer "nenhum plano cadastrado" quando o
    // que houve foi queda de rede — informação errada com cara de certeza.
    await expect(fetchPlans()).rejects.toEqual(NETWORK_FAILURE.error);
  });

  it('deveFiltrarSomenteAtivosQuandoSolicitado', async () => {
    const chain = mockQuery({ data: [PLANO], error: null });
    await fetchPlans(true);
    expect(chain.eq).toHaveBeenCalledWith('is_active', true);
  });

  it('naoDeveFiltrarQuandoOAdminQuerVerTambemOsDesativados', async () => {
    const chain = mockQuery({ data: [PLANO], error: null });
    await fetchPlans(false);
    expect(chain.eq).not.toHaveBeenCalled();
  });

  it('deveDevolverAListaQuandoAConsultaFunciona', async () => {
    mockQuery({ data: [PLANO], error: null });
    await expect(fetchPlans()).resolves.toEqual([PLANO]);
  });
});

describe('createPlan', () => {
  it('devePropagarARecusaDaRlsQuandoQuemChamaNaoEhAdmin', async () => {
    mockQuery(RLS_DENIED);
    // Engolir este erro faria a tela mostrar "plano criado" para um aluno que,
    // na verdade, não criou nada.
    await expect(createPlan(ENTRADA)).rejects.toEqual(RLS_DENIED.error);
  });

  it('deveRemoverEspacosDoNomeEDaDescricaoAntesDeGravar', async () => {
    const chain = mockQuery({ data: PLANO, error: null });
    await createPlan(ENTRADA);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Mensal 3x',
        description: 'treino três vezes por semana',
      }),
    );
  });

  it('deveGravarDescricaoNulaQuandoOTextoEhSoEspaco', async () => {
    const chain = mockQuery({ data: PLANO, error: null });
    await createPlan({ ...ENTRADA, description: '   ' });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it('deveGravarDescricaoNulaQuandoNaoInformada', async () => {
    const chain = mockQuery({ data: PLANO, error: null });
    await createPlan({ ...ENTRADA, description: null });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    );
  });

  it('devePreservarOPrecoEmCentavosSemConverterParaDecimal', async () => {
    const chain = mockQuery({ data: PLANO, error: null });
    await createPlan({ ...ENTRADA, priceCents: 1 });
    // 1 centavo precisa chegar como 1, não como 0.01 — float em dinheiro
    // acumula erro e o fechamento do mês não bate.
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ price_cents: 1 }),
    );
  });

  it('deveAceitarPrecoZeroParaPlanoDeCortesia', async () => {
    const chain = mockQuery({ data: { ...PLANO, price_cents: 0 }, error: null });
    await createPlan({ ...ENTRADA, priceCents: 0 });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ price_cents: 0 }),
    );
  });
});

describe('updatePlan', () => {
  it('devePropagarOErroQuandoAAtualizacaoFalha', async () => {
    mockQuery(RLS_DENIED);
    await expect(updatePlan('plan-1', ENTRADA)).rejects.toEqual(RLS_DENIED.error);
  });

  it('deveAlterarApenasOPlanoIndicado', async () => {
    const chain = mockQuery({ data: PLANO, error: null });
    await updatePlan('plan-1', ENTRADA);
    expect(chain.eq).toHaveBeenCalledWith('id', 'plan-1');
  });
});

describe('deactivatePlan', () => {
  it('deveDesativarEmVezDeExcluirParaNaoQuebrarOHistorico', async () => {
    const chain = mockQuery({ data: null, error: null });
    await deactivatePlan('plan-1');
    // Excluir romperia o vínculo dos pagamentos que apontam para este plano.
    expect(chain.delete).not.toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalledWith({ is_active: false });
    expect(chain.eq).toHaveBeenCalledWith('id', 'plan-1');
  });

  it('devePropagarOErroQuandoADesativacaoFalha', async () => {
    mockQuery(NETWORK_FAILURE);
    await expect(deactivatePlan('plan-1')).rejects.toEqual(NETWORK_FAILURE.error);
  });
});
