import {
  dataBrValidaParaIso,
  horaCurta,
  horaValida,
  horarioEstaAtivo,
  nomeDoDia,
  rotuloDaTurma,
  validarHorario,
  vigenciaEmTexto,
  type ValoresDoHorario,
} from '@/utils/gradeSemanal';

const VALIDO: ValoresDoHorario = {
  titulo: ' Muay Thai ',
  weekday: 1,
  hora: '19:00',
  inicioBr: '01/03/2030',
  fimBr: '',
};

describe('validarHorario', () => {
  it('deveAceitarSemDataDeFim', () => {
    expect(validarHorario(VALIDO)).toEqual({
      ok: true,
      horario: { titulo: 'Muay Thai', weekday: 1, hora: '19:00', inicioIso: '2030-03-01', fimIso: null },
    });
  });

  it.each([
    [{ titulo: '   ' }, 'Informe o título da aula.'],
    [{ weekday: null }, 'Escolha o dia da semana.'],
    [{ weekday: 7 }, 'Escolha o dia da semana.'],
    [{ hora: '24:00' }, 'Informe a hora no formato HH:MM.'],
    [{ hora: '7:00' }, 'Informe a hora no formato HH:MM.'],
    [{ inicioBr: '31/02/2030' }, 'Informe o início da vigência (DD/MM/AAAA).'],
    [{ fimBr: '01/13/2030' }, 'Data de fim inválida (DD/MM/AAAA).'],
    [{ fimBr: '28/02/2030' }, 'O fim da vigência não pode ser antes do início.'],
  ])('deveRecusar %o', (alteracao, mensagem) => {
    expect(validarHorario({ ...VALIDO, ...alteracao })).toEqual({ ok: false, mensagem });
  });

  it('deveAceitarFimNoMesmoDiaDoInicio', () => {
    const resultado = validarHorario({ ...VALIDO, fimBr: '01/03/2030' });
    expect(resultado.ok).toBe(true);
  });
});

describe('utilitários da grade', () => {
  it('deveNomearODiaComoOBanco', () => {
    expect(nomeDoDia(0)).toBe('Domingo');
    expect(nomeDoDia(6)).toBe('Sábado');
    expect(nomeDoDia(9)).toBe('');
  });

  it('deveEncurtarAHoraDoPostgres', () => {
    expect(horaCurta('19:30:00')).toBe('19:30');
    expect(horaValida('00:00')).toBe(true);
    expect(horaValida('23:59')).toBe(true);
    expect(horaValida('23:60')).toBe(false);
  });

  it('deveConferirOCalendario', () => {
    expect(dataBrValidaParaIso('29/02/2028')).toBe('2028-02-29');
    expect(dataBrValidaParaIso('29/02/2030')).toBeNull();
    expect(dataBrValidaParaIso('01/03')).toBeNull();
  });

  it('deveDescreverAVigencia', () => {
    expect(vigenciaEmTexto('2030-03-01', null)).toBe('Desde 01/03/2030');
    expect(vigenciaEmTexto('2030-03-01', '2030-03-31')).toBe('01/03/2030 a 31/03/2030');
  });

  it('deveConsiderarAtivoOHorarioQueTerminaHoje', () => {
    expect(horarioEstaAtivo(null, '2030-03-10')).toBe(true);
    expect(horarioEstaAtivo('2030-03-10', '2030-03-10')).toBe(true);
    expect(horarioEstaAtivo('2030-03-09', '2030-03-10')).toBe(false);
  });

  it('deveMarcarATurmaArquivada', () => {
    expect(rotuloDaTurma({ name: 'Turma A', archived_at: null })).toBe('Turma A');
    expect(rotuloDaTurma({ name: 'Turma A', archived_at: '2030-01-01T00:00:00Z' })).toBe('Turma A (arquivada)');
  });
});
