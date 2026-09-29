import { aulaDoAluno } from '@/test-utils/aulaDoAluno';
import { avisoDeFimDoHorario, ehReposicao, opcoesDeOrigem, rotuloDaTroca, tomDaTroca } from '@/utils/trocas';

describe('rotuloDaTroca (§ 3)', () => {
  it.each([
    [{ status: 'pending', decidedVia: null, approvedByName: null }, 'Troca pendente'],
    [{ status: 'approved', decidedVia: 'review', approvedByName: 'Ana' }, 'Troca aprovada por Ana'],
    [{ status: 'approved', decidedVia: 'system', approvedByName: null }, 'Troca abonada: a aula nova foi cancelada'],
    [{ status: 'rejected', decidedVia: 'review', approvedByName: null }, 'Troca negada'],
    [{ status: 'expired', decidedVia: 'roll_call', approvedByName: null }, 'Troca expirada · vale a aula original'],
    [{ status: 'cancelled', decidedVia: 'student', approvedByName: null }, 'Você desistiu da troca'],
    [{ status: 'cancelled', decidedVia: 'system', approvedByName: null }, 'Troca cancelada'],
  ] as const)('deveEscreverOEstado %#', (troca, esperado) => {
    expect(rotuloDaTroca(troca)).toBe(esperado);
  });

  it('deveDarUmTomPorEstado', () => {
    expect(tomDaTroca('approved')).toBe('destaque');
    expect(tomDaTroca('rejected')).toBe('erro');
    expect(tomDaTroca('pending')).toBe('aviso');
    expect(tomDaTroca('expired')).toBe('neutro');
  });
});

describe('opcoesDeOrigem (§ 12, colunas do banco)', () => {
  const nova = aulaDoAluno({ class_id: 'nova', can_swap_from: true, can_swap_from_permanent: true });
  const avulsa = aulaDoAluno({ class_id: 'a', can_swap_from: true });
  const permanente = aulaDoAluno({ class_id: 'b', can_swap_from: true, can_swap_from_permanent: true });
  const nenhuma = aulaDoAluno({ class_id: 'c' });

  it('deveUsarACorretaDeCadaTipoESemANova', () => {
    expect(opcoesDeOrigem([nova, avulsa, permanente, nenhuma], nova, 'once').map((a) => a.class_id)).toEqual(['a', 'b']);
    expect(opcoesDeOrigem([nova, avulsa, permanente, nenhuma], nova, 'permanent').map((a) => a.class_id)).toEqual(['b']);
  });
});

describe('textos da folha', () => {
  it('deveEscreverOFimDoHorario', () => {
    expect(avisoDeFimDoHorario('2026-12-19')).toBe('Este horário termina em 19/12.');
  });

  it('deveMarcarReposicaoNaAulaQueJaComecou', () => {
    const agora = new Date('2030-03-10T12:00:00Z');
    expect(ehReposicao({ date_time: '2030-03-09T12:00:00Z' }, agora)).toBe(true);
    expect(ehReposicao({ date_time: '2030-03-11T12:00:00Z' }, agora)).toBe(false);
  });
});
