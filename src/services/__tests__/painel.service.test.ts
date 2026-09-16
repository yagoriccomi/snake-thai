import { NETWORK_FAILURE, RLS_DENIED } from '@/test-utils/supabaseMock';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]): unknown => mockRpc(...args),
  },
}));

import {
  fetchAlunosEmRisco,
  fetchFaturamentoMensal,
  fetchInadimplenciaFaixas,
  fetchPainelResumo,
  fetchRelatorioInadimplencia,
  fetchSaudeDasRotinas,
} from '@/services/painel.service';

const RESUMO = {
  alunos_ativos: 50,
  alunos_inativos: 2,
  alunos_ativos_sem_plano: 1,
  saidas_no_mes: 1,
  competencia: '2026-09-01',
  esperado_cents: 500000,
  recebido_cents: 140000,
  em_analise_cents: 130000,
  em_aberto_cents: 100000,
  vencido_cents: 130000,
  mensalidades_total: 50,
  mensalidades_pagas: 14,
  inadimplencia_cents: 280000,
  alunos_inadimplentes: 25,
  inadimplencia_contas_encerradas_cents: 0,
  frequencia_media_mes: 80.69,
  alunos_com_aula_no_mes: 50,
  ultimo_mes_fechado: '2026-08-01',
  frequencia_media_ultimo_mes: null,
  alunos_com_aula_ultimo_mes: 0,
};

beforeEach(() => {
  mockRpc.mockReset();
});

describe('fetchPainelResumo', () => {
  it('deveTraduzirALinhaDoBancoAceitandoMediaNula', async () => {
    mockRpc.mockResolvedValue({ data: [RESUMO], error: null });

    const resumo = await fetchPainelResumo();

    expect(mockRpc).toHaveBeenCalledWith('painel_admin_resumo');
    expect(resumo).toMatchObject({
      alunosAtivos: 50,
      competencia: '2026-09-01',
      recebidoCents: 140000,
      inadimplenciaCents: 280000,
      frequenciaMediaMes: 80.69,
      frequenciaMediaUltimoMes: null,
    });
  });

  it('deveFalharAltoQuandoUmCampoSomeOuVemSemLinha', async () => {
    const { alunos_ativos: _removido, ...semCampo } = RESUMO;
    mockRpc.mockResolvedValueOnce({ data: [semCampo], error: null });
    await expect(fetchPainelResumo()).rejects.toThrow('painel_admin_resumo.alunos_ativos');

    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(fetchPainelResumo()).rejects.toThrow('sem linha');
  });

  it('devePropagarARecusaDoBanco', async () => {
    mockRpc.mockResolvedValue(RLS_DENIED);
    await expect(fetchPainelResumo()).rejects.toEqual(RLS_DENIED.error);
  });
});

describe('fetchInadimplenciaFaixas', () => {
  it('deveOrdenarAsFaixasPelaOrdemDoBanco', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { faixa: '60+', ordem: 3, mensalidades: 1, valor_cents: 10000 },
        { faixa: '1-30', ordem: 1, mensalidades: 23, valor_cents: 230000 },
        { faixa: '31-60', ordem: 2, mensalidades: 4, valor_cents: 40000 },
      ],
      error: null,
    });

    await expect(fetchInadimplenciaFaixas()).resolves.toEqual([
      { faixa: '1-30', mensalidades: 23, valorCents: 230000 },
      { faixa: '31-60', mensalidades: 4, valorCents: 40000 },
      { faixa: '60+', mensalidades: 1, valorCents: 10000 },
    ]);
  });

  it('deveRecusarFaixaDesconhecida', async () => {
    mockRpc.mockResolvedValue({ data: [{ faixa: '90+', ordem: 4, mensalidades: 1, valor_cents: 1 }], error: null });
    await expect(fetchInadimplenciaFaixas()).rejects.toThrow('painel_inadimplencia_faixas.faixa');
  });
});

describe('fetchFaturamentoMensal', () => {
  it('devePedir12MesesPorPadraoEConverterBigintEmTexto', async () => {
    mockRpc.mockResolvedValue({
      data: [{ reference_month: '2026-09-01', esperado_cents: '500000', recebido_cents: 140000, pendente_cents: 360000 }],
      error: null,
    });

    const meses = await fetchFaturamentoMensal();

    expect(mockRpc).toHaveBeenCalledWith('painel_faturamento_mensal', { p_meses: 12 });
    expect(meses).toEqual([
      { referenceMonth: '2026-09-01', esperadoCents: 500000, recebidoCents: 140000, pendenteCents: 360000 },
    ]);
  });

  it('devePropagarFalhaDeRede', async () => {
    mockRpc.mockResolvedValue(NETWORK_FAILURE);
    await expect(fetchFaturamentoMensal()).rejects.toEqual(NETWORK_FAILURE.error);
  });
});

describe('fetchAlunosEmRisco', () => {
  it('deveMandarOsLimitesEAceitarTurmaEPercentualNulos', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'a-1', nome: 'Ana', turma: null, frequencia_mes_atual: null, frequencia_ultimo_mes: 25 }],
      error: null,
    });

    const alunos = await fetchAlunosEmRisco();

    expect(mockRpc).toHaveBeenCalledWith('painel_alunos_em_risco', { p_limite_percent: 50, p_min_aulas: 4 });
    expect(alunos).toEqual([
      { userId: 'a-1', nome: 'Ana', turma: null, frequenciaMesAtual: null, frequenciaUltimoMes: 25 },
    ]);
  });
});

describe('fetchRelatorioInadimplencia', () => {
  it('deveTraduzirOsDevedores', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          user_id: 'a-3',
          nome: 'Aluno Três',
          turma: 'Turma Noite',
          aluno_ativo: false,
          mensalidades: 2,
          total_devido_cents: 33000,
          maior_atraso_dias: 61,
          vencimento_mais_antigo: '2031-03-20',
        },
      ],
      error: null,
    });

    await expect(fetchRelatorioInadimplencia()).resolves.toEqual([
      {
        userId: 'a-3',
        nome: 'Aluno Três',
        turma: 'Turma Noite',
        alunoAtivo: false,
        mensalidades: 2,
        totalDevidoCents: 33000,
        maiorAtrasoDias: 61,
        vencimentoMaisAntigo: '2031-03-20',
      },
    ]);
    expect(mockRpc).toHaveBeenCalledWith('relatorio_inadimplencia');
  });
});

describe('fetchSaudeDasRotinas', () => {
  it('deveTraduzirAsRotinasAceitandoRotinaQueNuncaRodou', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { rotina: 'generate-monthly-payments', agenda: '10 0 1 * *', ultima_execucao: '2026-09-01T00:10:00Z', ultimo_status: 'failed', falhas_24h: 1 },
        { rotina: 'push-limpeza', agenda: '30 6 * * *', ultima_execucao: null, ultimo_status: null, falhas_24h: 0 },
      ],
      error: null,
    });

    await expect(fetchSaudeDasRotinas()).resolves.toEqual([
      { rotina: 'generate-monthly-payments', ultimaExecucao: '2026-09-01T00:10:00Z', ultimoStatus: 'failed', falhas24h: 1 },
      { rotina: 'push-limpeza', ultimaExecucao: null, ultimoStatus: null, falhas24h: 0 },
    ]);
    expect(mockRpc).toHaveBeenCalledWith('saude_das_rotinas');
  });

  it('devePropagarARecusaDoBanco', async () => {
    mockRpc.mockResolvedValue(RLS_DENIED);
    await expect(fetchSaudeDasRotinas()).rejects.toEqual(RLS_DENIED.error);
  });
});
