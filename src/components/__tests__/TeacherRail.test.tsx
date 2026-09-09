import React from 'react';
import { render } from '@testing-library/react-native';

import { TeacherRail } from '@/components/TeacherRail';
import type { ClassTeacherRef } from '@/services/classes.service';
import { ThemeProvider } from '@/theme/ThemeProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function teacher(overrides: Partial<ClassTeacherRef> = {}): ClassTeacherRef {
  return {
    id: 'teacher-1',
    name: 'Prof. Ana',
    color: '#FF0000',
    joinedAt: '2030-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TeacherRail', () => {
  it('deveRenderizarUmaUnicaFaixaParaUmSoProfessor', () => {
    const { UNSAFE_root } = renderWithTheme(<TeacherRail teachers={[teacher()]} />);
    // View raiz (o trilho) + 1 View filha (a faixa colorida).
    expect(UNSAFE_root.findAllByType('View' as never)).toHaveLength(2);
  });

  it('deveRenderizarUmaFaixaPorProfessorQuandoHaMaisDeUm', () => {
    const teachers = [teacher({ id: 't1' }), teacher({ id: 't2', color: '#00FF00' })];
    const { UNSAFE_root } = renderWithTheme(<TeacherRail teachers={teachers} />);
    // Trilho dividido em bandas — uma cor por professor, não a cor de só um. [#55]
    expect(UNSAFE_root.findAllByType('View' as never)).toHaveLength(3);
  });

  it('naoDeveQuebrarQuandoNaoHaProfessorVinculado', () => {
    expect(() => renderWithTheme(<TeacherRail teachers={[]} />)).not.toThrow();
  });
});
