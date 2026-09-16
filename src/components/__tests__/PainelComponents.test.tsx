import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { OverdueBucketsCard } from '@/components/OverdueBucketsCard';
import { AtRiskStudentRow, DelinquentStudentRow } from '@/components/PainelStudentRows';
import { RevenueBarChart } from '@/components/RevenueBarChart';
import { SaudeDasRotinasCard } from '@/components/SaudeDasRotinasCard';
import type { MesDeFaturamento } from '@/services/painel.service';
import { ThemeProvider } from '@/theme/ThemeProvider';

function comTema(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function mes(referenceMonth: string, esperadoCents: number, recebidoCents: number): MesDeFaturamento {
  return { referenceMonth, esperadoCents, recebidoCents, pendenteCents: esperadoCents - recebidoCents };
}

const DOZE_MESES = Array.from({ length: 12 }, (_valor, indice) =>
  mes(`2026-${String(indice + 1).padStart(2, '0')}-01`, 500000, 400000),
);

describe('RevenueBarChart', () => {
  it('deveTerUmaColunaAcessivelPorMes', () => {
    const { getAllByLabelText, getByLabelText } = comTema(<RevenueBarChart meses={DOZE_MESES} />);

    expect(getAllByLabelText(/: esperado R\$/)).toHaveLength(12);
    expect(getByLabelText(/^Agosto de 2026: esperado R\$\s?5\.000,00, recebido R\$\s?4\.000,00$/)).toBeTruthy();
  });

  it('deveRenderizarSemNaNQuandoTudoEZero', () => {
    const zerados = DOZE_MESES.map((item) => mes(item.referenceMonth, 0, 0));
    const tela = comTema(<RevenueBarChart meses={zerados} />);

    expect(JSON.stringify(tela.toJSON())).not.toContain('NaN');
  });
});

describe('OverdueBucketsCard', () => {
  const FAIXAS = [
    { faixa: '1-30' as const, mensalidades: 23, valorCents: 230000 },
    { faixa: '31-60' as const, mensalidades: 4, valorCents: 40000 },
    { faixa: '60+' as const, mensalidades: 1, valorCents: 10000 },
  ];

  it('deveMostrarAsTresFaixasPorEscritoEEsconderContasEncerradasZeradas', () => {
    const onVerRelatorio = jest.fn();
    const { getByText, queryByText, getByRole } = comTema(
      <OverdueBucketsCard totalCents={280000} alunos={25} faixas={FAIXAS} contasEncerradasCents={0} onVerRelatorio={onVerRelatorio} />,
    );

    expect(getByText('1 a 30 dias')).toBeTruthy();
    expect(getByText('31 a 60 dias')).toBeTruthy();
    expect(getByText('Mais de 60 dias')).toBeTruthy();
    expect(getByText('1 mensalidade')).toBeTruthy();
    expect(queryByText('Contas encerradas')).toBeNull();

    fireEvent.press(getByRole('button', { name: 'Ver relatório' }));
    expect(onVerRelatorio).toHaveBeenCalledTimes(1);
  });

  it('deveMostrarContasEncerradasSemNomeQuandoHaValor', () => {
    const { getByText } = comTema(
      <OverdueBucketsCard totalCents={280000} alunos={25} faixas={FAIXAS} contasEncerradasCents={18000} onVerRelatorio={jest.fn()} />,
    );

    expect(getByText('Contas encerradas')).toBeTruthy();
  });
});

describe('linhas de aluno', () => {
  it('deveAbrirODevedorEMarcarOInativo', () => {
    const devedor = {
      userId: 'a-3',
      nome: 'Aluno Três',
      turma: null,
      alunoAtivo: false,
      mensalidades: 2,
      totalDevidoCents: 33000,
      maiorAtrasoDias: 61,
      vencimentoMaisAntigo: '2031-03-20',
    };
    const onPress = jest.fn();
    const { getByText, getByRole } = comTema(<DelinquentStudentRow devedor={devedor} onPress={onPress} />);

    expect(getByText('Inativo')).toBeTruthy();
    expect(getByText('Sem turma · 2 mensalidades · 61 dias de atraso')).toBeTruthy();
    fireEvent.press(getByRole('button', { name: /^Aluno Três, Sem turma, inativo: deve R\$/ }));
    expect(onPress).toHaveBeenCalledWith(devedor);
  });

  it('deveMostrarTracoQuandoOMesAtualNaoTemAulasSuficientes', () => {
    const aluno = { userId: 'a-6', nome: 'Aluno Seis', turma: 'Turma C', frequenciaMesAtual: null, frequenciaUltimoMes: 25 };
    const onPress = jest.fn();
    const { getByText, getByRole } = comTema(<AtRiskStudentRow aluno={aluno} onPress={onPress} />);

    expect(getByText('Turma C · Este mês — · Mês passado 25%')).toBeTruthy();
    fireEvent.press(getByRole('button', { name: /sem aulas suficientes neste mês e 25% no mês passado$/ }));
    expect(onPress).toHaveBeenCalledWith(aluno);
  });
});

describe('SaudeDasRotinasCard', () => {
  it('naoDeveOcuparOPainelSemProblema', () => {
    const tela = comTema(<SaudeDasRotinasCard rotinas={[]} />);
    expect(tela.toJSON()).toBeNull();
  });

  it('deveDizerQualRotinaFalhouComoAlerta', () => {
    const { getByText, UNSAFE_getByProps, getByLabelText } = comTema(
      <SaudeDasRotinasCard
        rotinas={[{ rotina: 'generate-monthly-payments', nome: 'Gerar as mensalidades do mês', descricao: 'A última execução falhou.' }]}
      />,
    );

    // Container não focável de propósito (cada rotina é lida em separado): o RNTL
    // não o acha por papel, então a busca é pela propriedade.
    expect(UNSAFE_getByProps({ accessibilityRole: 'alert' })).toBeTruthy();
    expect(getByText('Uma rotina automática falhou')).toBeTruthy();
    expect(getByLabelText('Gerar as mensalidades do mês: A última execução falhou.')).toBeTruthy();
  });
});
