import React from 'react';
import { render } from '@testing-library/react-native';

import { TeacherDot } from '@/components/TeacherDot';
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

describe('TeacherDot', () => {
  it('deveExibirONomeDeCadaProfessorVinculado', () => {
    const teachers = [teacher({ id: 't1', name: 'Prof. Ana' }), teacher({ id: 't2', name: 'Prof. Bruno' })];
    const { getByText } = renderWithTheme(<TeacherDot teachers={teachers} />);
    expect(getByText('Prof. Ana')).toBeTruthy();
    expect(getByText('Prof. Bruno')).toBeTruthy();
  });

  it('deveExibirUmRotuloPadraoQuandoOProfessorNaoTemNome', () => {
    const { getByText } = renderWithTheme(<TeacherDot teachers={[teacher({ name: null })]} />);
    expect(getByText('Professor')).toBeTruthy();
  });

  it('naoDeveRenderizarNadaSemProfessorVinculado', () => {
    const { toJSON } = renderWithTheme(<TeacherDot teachers={[]} />);
    expect(toJSON()).toBeNull();
  });
});
