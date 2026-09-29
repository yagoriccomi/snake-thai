const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]): unknown => mockRpc(...args) },
}));

import {
  abrirSolicitacao,
  decidirSolicitacao,
  fetchCaixaDeSolicitacoes,
  fetchSolicitacaoParaDecidir,
} from '@/services/solicitacoes.service';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('solicitacoes.service (§ 9.3)', () => {
  it('deveCriarOMotivoEAbrirOPedido', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'm-1', error: null }).mockResolvedValueOnce({ data: 's-1', error: null });
    await expect(abrirSolicitacao('student_was_present', 'c-1', '  Cheguei atrasado ')).resolves.toBe('s-1');
    expect(mockRpc.mock.calls).toEqual([
      ['criar_motivo', { p_kind: 'request_evidence', p_class_id: 'c-1', p_texto: 'Cheguei atrasado' }],
      ['abrir_solicitacao', { p_kind: 'student_was_present', p_class_id: 'c-1', p_motivo_id: 'm-1' }],
    ]);
  });

  it('deveMostrarAFraseDoBancoNaRecusa', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 'm-1', error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'Você já fez este pedido para esta aula.' } });
    await expect(abrirSolicitacao('teacher_absence', 'c-1', 'x')).rejects.toMatchObject({
      message: 'Você já fez este pedido para esta aula.',
    });
  });

  it('deveDecidirComANotaAparada', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await decidirSolicitacao('s-1', 'approved', ' Visto ');
    expect(mockRpc).toHaveBeenCalledWith('decidir_solicitacao', { p_id: 's-1', p_decisao: 'approved', p_nota: 'Visto' });
  });

  it('deveDeixarDeForaCategoriaQueOAppNaoConhece', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { categoria: 'faltas_de_alunos', quantidade: 2 },
        { categoria: 'categoria_do_futuro', quantidade: 9 },
      ],
      error: null,
    });
    await expect(fetchCaixaDeSolicitacoes()).resolves.toEqual([{ categoria: 'faltas_de_alunos', quantidade: 2 }]);
  });

  it('deveFalharQuandoOPedidoNaoVem', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await expect(fetchSolicitacaoParaDecidir('s-1')).rejects.toThrow('Solicitação não encontrada.');
  });
});
