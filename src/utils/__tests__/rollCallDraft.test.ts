import {
  avaliarRascunho,
  chaveDoRascunho,
  interpretarRascunhoGuardado,
  mesmasMarcacoes,
  rascunhoVencido,
  restringirAosAlunos,
  somenteMarcados,
  VALIDADE_DO_RASCUNHO_MS,
  VERSAO_DO_RASCUNHO,
  type RascunhoGuardado,
} from '@/utils/rollCallDraft';

const AGORA = Date.parse('2026-09-16T12:00:00.000Z');
const ALUNOS = ['aluno-1', 'aluno-2', 'aluno-3'];

function guardado(parcial: Partial<RascunhoGuardado> = {}): RascunhoGuardado {
  return {
    versao: VERSAO_DO_RASCUNHO,
    classId: 'aula-1',
    salvoEm: '2026-09-16T11:00:00.000Z',
    base: { marcacoes: {}, concluidaEm: null },
    marcacoes: { 'aluno-1': 'present', 'aluno-2': 'absent' },
    ...parcial,
  };
}

describe('chaveDoRascunho', () => {
  it('deveSepararPorUsuarioEPorAula', () => {
    const chaves = new Set([
      chaveDoRascunho('prof-a', 'aula-1'),
      chaveDoRascunho('prof-b', 'aula-1'),
      chaveDoRascunho('prof-a', 'aula-2'),
    ]);
    expect(chaves.size).toBe(3);
  });

  it('deveGerarChaveAceitaPeloSecureStore', () => {
    const chave = chaveDoRascunho('4f1c9a2e-0b7d-4c1e-9f7a-1234567890ab', 'aula/1 é?');
    expect(chave).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(chave.startsWith('rollcall_draft.')).toBe(true);
  });
});

describe('marcações', () => {
  it('somenteMarcadosDeveTirarOsNaoMarcados', () => {
    expect(somenteMarcados({ a: 'present', b: null, c: 'absent' })).toEqual({ a: 'present', c: 'absent' });
  });

  it('mesmasMarcacoesDeveIgnorarAOrdemETratarNaoMarcadoComoAusente', () => {
    expect(mesmasMarcacoes({ a: 'present', b: null }, { a: 'present' })).toBe(true);
    expect(mesmasMarcacoes({ b: 'absent', a: 'present' }, { a: 'present', b: 'absent' })).toBe(true);
    expect(mesmasMarcacoes({ a: 'present' }, { a: 'absent' })).toBe(false);
    expect(mesmasMarcacoes({}, { a: 'absent' })).toBe(false);
  });

  it('restringirAosAlunosDeveTirarQuemSaiuDaAula', () => {
    expect(restringirAosAlunos({ 'aluno-1': 'present', saiu: 'absent' }, ALUNOS)).toEqual({
      'aluno-1': 'present',
    });
  });
});

describe('interpretarRascunhoGuardado', () => {
  it('deveAceitarUmRegistroValido', () => {
    const registro = guardado({ base: { marcacoes: { 'aluno-3': 'absent' }, concluidaEm: '2026-09-15T10:00:00Z' } });
    expect(interpretarRascunhoGuardado(JSON.stringify(registro))).toEqual(registro);
  });

  it.each([
    ['JSON quebrado', '{"versao":1,'],
    ['outra versão', JSON.stringify({ ...guardado(), versao: 2 })],
    ['status inválido', JSON.stringify(guardado({ marcacoes: { 'aluno-1': 'late' as never } }))],
    ['data ilegível', JSON.stringify(guardado({ salvoEm: 'ontem' }))],
    ['sem base', JSON.stringify({ ...guardado(), base: null })],
    ['conclusão com tipo errado', JSON.stringify({ ...guardado(), base: { marcacoes: {}, concluidaEm: 5 } })],
    ['lista em vez de objeto', JSON.stringify({ ...guardado(), marcacoes: ['present'] })],
  ])('deveRecusar %s', (_caso, texto) => {
    expect(interpretarRascunhoGuardado(texto)).toBeNull();
  });
});

describe('rascunhoVencido', () => {
  const salvoEm = new Date(AGORA - VALIDADE_DO_RASCUNHO_MS).toISOString();

  it('naoDeveVencerExatamenteNoLimite', () => {
    expect(rascunhoVencido(salvoEm, AGORA)).toBe(false);
  });

  it('deveVencerUmMilissegundoDepoisDoLimite', () => {
    expect(rascunhoVencido(salvoEm, AGORA + 1)).toBe(true);
  });

  it('deveTratarDataIlegivelComoVencida', () => {
    expect(rascunhoVencido('não é data', AGORA)).toBe(true);
  });
});

describe('avaliarRascunho', () => {
  const avaliar = (registro: RascunhoGuardado, gravado = {}, concluidaEm: string | null = null) =>
    avaliarRascunho({ guardado: registro, gravado, concluidaEm, alunoIds: ALUNOS, agoraMs: AGORA });

  it('deveRecuperarQuandoOGravadoNaoMudouDesdeABase', () => {
    expect(avaliar(guardado())).toBe('recuperar');
  });

  it('deveApontarVencidoAntesDeIdentico', () => {
    const velho = guardado({ salvoEm: '2026-01-01T00:00:00Z', marcacoes: {} });
    expect(avaliar(velho)).toBe('vencido');
  });

  it('deveApontarIdenticoAntesDeConflito', () => {
    // A base está desatualizada, mas o rascunho já é o que está gravado: nada a perguntar.
    const registro = guardado({ base: { marcacoes: {}, concluidaEm: null } });
    const gravado = { 'aluno-1': 'present', 'aluno-2': 'absent' } as const;
    expect(avaliar(registro, gravado, '2026-09-16T11:30:00Z')).toBe('identico');
  });

  it('deveAcusarConflitoQuandoOutraPessoaMudouAsMarcacoes', () => {
    expect(avaliar(guardado(), { 'aluno-3': 'present' })).toBe('conflito');
  });

  it('deveAcusarConflitoQuandoAChamadaFoiConcluidaComAsMesmasMarcacoes', () => {
    expect(avaliar(guardado(), {}, '2026-09-16T11:30:00Z')).toBe('conflito');
  });

  it('naoDeveDeixarAlunoQueSaiuDaTurmaImpedirOIdentico', () => {
    const registro = guardado({ marcacoes: { 'aluno-1': 'present', saiu: 'absent' } });
    expect(avaliar(registro, { 'aluno-1': 'present' })).toBe('identico');
  });
});
