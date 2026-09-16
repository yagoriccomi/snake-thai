import { destinoDaNotificacao } from '@/utils/notificationRouting';

const UUID = '8b4284f0-8048-458d-a1d8-6980967e1b55';

describe('destinoDaNotificacao', () => {
  it.each([
    ['mensalidade_vence_em_breve', 'Financeiro'],
    ['mensalidade_vence_hoje', 'Financeiro'],
    ['mensalidade_atrasada', 'Financeiro'],
    ['comprovante_enviado', 'Financeiro'],
    ['comprovante_aprovado', 'Financeiro'],
    ['comprovante_recusado', 'Financeiro'],
    ['justificativa_pendente', 'Aulas'],
    ['aula_sem_chamada', 'Aulas'],
    ['aulas_sem_chamada_resumo', 'Aulas'],
  ])('%s abre a aba %s', (tipo, aba) => {
    expect(destinoDaNotificacao({ tipo, paymentId: UUID })?.aba).toBe(aba);
  });

  it('naoDeveNavegarComPayloadDesconhecidoOuMalformado', () => {
    expect(destinoDaNotificacao(null)).toBeNull();
    expect(destinoDaNotificacao('comprovante_enviado')).toBeNull();
    expect(destinoDaNotificacao({ tipo: 'outro' })).toBeNull();
    expect(destinoDaNotificacao({})).toBeNull();
    // Id que não é UUID vem de fora do app e não é confiável.
    expect(destinoDaNotificacao({ tipo: 'aula_sem_chamada', classId: '../../admin' })).toBeNull();
    expect(destinoDaNotificacao({ tipo: 'comprovante_enviado', paymentId: 42 })).toBeNull();
  });
});
