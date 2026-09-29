import { alunoDaChamada, professorDaChamada } from '@/test-utils/chamada';
import {
  confirmacaoDeConclusao,
  contarDaChamada,
  detalhesDaLinha,
  diasDepoisDaAula,
  montarBlocos,
  montarEnvio,
  mudancasDaChamada,
  professoresSemMarcacao,
  seloDaLinha,
  textoFeitaDepois,
  type LinhaDaChamada,
} from '@/utils/chamada';

const OUTRA = '2030-03-14T22:00:00.000Z';

function linha(parcial: Parameters<typeof alunoDaChamada>[0] = {}): LinhaDaChamada {
  const aluno = alunoDaChamada(parcial);
  return { userId: aluno.userId, nome: aluno.name ?? '', origem: aluno.origem, aluno };
}

describe('montarBlocos (mockups das linhas C e G)', () => {
  it('deveAgruparNaOrdemDaTelaEPularBlocoVazio', () => {
    const blocos = montarBlocos(
      [
        alunoDaChamada({ userId: 'a', origem: 'marcou' }),
        alunoDaChamada({ userId: 'b', origem: 'turma' }),
        alunoDaChamada({ userId: 'c', origem: 'troca_pendente' }),
        alunoDaChamada({ userId: 'd', origem: 'permanente' }),
        alunoDaChamada({ userId: 'e', origem: 'trocou' }),
      ],
      [{ id: 'novo', nome: 'Beto' }],
    );
    expect(blocos.map((b) => [b.titulo, b.linhas.map((l) => l.userId)])).toEqual([
      ['Da turma', ['b', 'd']],
      ['Marcaram', ['a']],
      ['Trocas', ['c']],
      ['Incluídos', ['novo']],
      ['Trocaram esta aula', ['e']],
    ]);
  });
});

describe('seloDaLinha e detalhesDaLinha (contrato § 3)', () => {
  it('deveUsarOsRotulosDoContrato', () => {
    expect(seloDaLinha(linha({ origem: 'troca_pendente' }))?.texto).toBe('Troca pendente');
    expect(seloDaLinha(linha({ origem: 'permanente' }))?.texto).toBe('Troca permanente');
    expect(seloDaLinha(linha({ origem: 'troca' }))?.texto).toBe('Troca');
    expect(seloDaLinha(linha({ origem: 'extra' }))?.texto).toBe('Extra');
    expect(seloDaLinha(linha({ origem: 'turma' }))).toBeNull();
  });

  it('deveDarADicaDaTrocaPendenteEODiaDasTrocas', () => {
    expect(detalhesDaLinha(linha({ origem: 'troca_pendente' }))).toContain('Marcar presença aprova a troca.');
    expect(detalhesDaLinha(linha({ origem: 'trocou', swapOtherDateTime: OUTRA }))[0]).toMatch(/^Trocou para \w{3} 14\/03 /);
    expect(detalhesDaLinha(linha({ origem: 'troca', swapOtherDateTime: OUTRA }))[0]).toMatch(/^No lugar de /);
  });

  it('deveMostrarASemanaDoLivreEAJustificativa', () => {
    expect(
      detalhesDaLinha(linha({ origem: 'marcou', scheduleMode: 'free', weeklyTarget: 3, weekAttended: 2, weekExpected: 3 })),
    ).toEqual(['Livre 3x · 2 de 3 nesta semana']);
    expect(detalhesDaLinha(linha({ justificationStatus: 'pending' }))).toEqual(['Justificativa em análise']);
  });
});

describe('montarEnvio (§ 7.2, regras 2 e 7)', () => {
  const linhas = [
    linha({ userId: 'turma-sem-marca', origem: 'turma' }),
    linha({ userId: 'marcou-sem-marca', origem: 'marcou' }),
    linha({ userId: 'pendente-sem-marca', origem: 'troca_pendente' }),
    linha({ userId: 'trocou', origem: 'trocou' }),
    linha({ userId: 'incluido-gravado', origem: 'incluido', status: 'present' }),
    linha({ userId: 'marcou-presente', origem: 'marcou' }),
  ];

  it('deveMandarAGradeSemMarcacaoComoFaltaEODemaisSemRegistro', () => {
    const envio = montarEnvio({
      linhas,
      rascunho: { 'marcou-presente': 'present' },
      retirados: new Set(),
      professores: [professorDaChamada()],
      presencaDosProfessores: { 'prof-1': true },
      motivoId: null,
    });
    expect(envio.presentes.sort()).toEqual(['incluido-gravado', 'marcou-presente']);
    expect(envio.ausentes).toEqual(['turma-sem-marca']);
    expect(envio.professoresPresentes).toEqual(['prof-1']);
  });

  it('deveRetirarOIncluidoEAcrescentarProfessor', () => {
    const envio = montarEnvio({
      linhas,
      rascunho: {},
      retirados: new Set(['incluido-gravado']),
      professores: [professorDaChamada()],
      presencaDosProfessores: { 'prof-1': true, 'prof-novo': true },
      motivoId: 'm-1',
    });
    expect(envio.removerIncluidos).toEqual(['incluido-gravado']);
    expect(envio.professoresPresentes.sort()).toEqual(['prof-1', 'prof-novo']);
    expect(envio.motivoId).toBe('m-1');
  });

  it('deveContarProfessorSemMarcacao', () => {
    expect(professoresSemMarcacao([professorDaChamada(), professorDaChamada({ teacherId: 'p2' })], { 'prof-1': true })).toBe(1);
  });
});

describe('mudancasDaChamada (folha Retificar)', () => {
  it('deveListarSoOQueMudou', () => {
    const linhas = [linha({ userId: 'a', name: 'Ana', status: 'absent' }), linha({ userId: 'b', name: 'Bia', status: 'present' })];
    const envio = montarEnvio({
      linhas,
      rascunho: { a: 'present', b: 'present' },
      retirados: new Set(),
      professores: [professorDaChamada({ present: true })],
      presencaDosProfessores: { 'prof-1': false },
      motivoId: null,
    });
    const mudancas = mudancasDaChamada(linhas, envio, [professorDaChamada({ present: true })], {});
    expect(mudancas.alunos).toEqual([{ userId: 'a', nome: 'Ana', antes: 'absent', depois: 'present' }]);
    expect(mudancas.professores).toEqual([{ teacherId: 'prof-1', nome: 'Rafael', antes: true, depois: false }]);
  });
});

describe('contagem e textos', () => {
  it('deveSepararSemMarcacaoQueViraFaltaDoQueFicaSemRegistro', () => {
    const contagem = contarDaChamada(
      [linha({ userId: 'a', origem: 'turma' }), linha({ userId: 'b', origem: 'marcou' }), linha({ userId: 'c', origem: 'turma' })],
      { c: 'present' },
    );
    expect(contagem).toEqual({ presentes: 1, faltas: 0, semMarcacaoFalta: 1, semMarcacaoSemRegistro: 1 });
    expect(confirmacaoDeConclusao(contagem)).toContain('1 aluno(s) da grade sem marcação serão registrados como falta.');
  });

  it('deveContarOsDiasDaChamadaAtrasada (T14)', () => {
    expect(diasDepoisDaAula('2030-03-10T12:00:00', '2030-03-10T23:00:00')).toBe(0);
    expect(diasDepoisDaAula('2030-03-10T12:00:00', '2030-03-11T08:00:00')).toBe(1);
    expect(textoFeitaDepois(0)).toBeNull();
    expect(textoFeitaDepois(1)).toBe('Feita 1 dia depois');
    expect(textoFeitaDepois(4)).toBe('Feita 4 dias depois');
  });
});
