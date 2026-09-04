import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ClassCard } from '@/components/ClassCard';
import type { StudentClassItem } from '@/hooks/useStudentClasses';
import { ThemeProvider } from '@/theme/ThemeProvider';

function makeItem(overrides: Partial<StudentClassItem> = {}): StudentClassItem {
  return {
    id: 'class-1',
    title: 'Muay Thai',
    type: 'routine',
    date_time: '2030-12-31T19:30:00.000Z',
    group_id: 'turma-a',
    created_at: '2030-01-01T00:00:00.000Z',
    updated_at: '2030-01-01T00:00:00.000Z',
    myStatus: null,
    teachers: [],
    ...overrides,
  };
}

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ClassCard', () => {
  it('registra presença ao confirmar', () => {
    const onRespond = jest.fn();
    const { getByRole } = renderWithTheme(
      <ClassCard item={makeItem()} onRespond={onRespond} />,
    );

    fireEvent.press(getByRole('button', { name: 'Confirmar Presença' }));
    expect(onRespond).toHaveBeenCalledWith('class-1', 'present');
  });

  it('registra falta ao avisar', () => {
    const onRespond = jest.fn();
    const { getByRole } = renderWithTheme(
      <ClassCard item={makeItem()} onRespond={onRespond} />,
    );

    fireEvent.press(getByRole('button', { name: 'Avisar Falta' }));
    expect(onRespond).toHaveBeenCalledWith('class-1', 'absent');
  });

  it('reflete a escolha já feita no estado do botão', () => {
    const onRespond = jest.fn();
    const { getByRole } = renderWithTheme(
      <ClassCard item={makeItem({ myStatus: 'present' })} onRespond={onRespond} />,
    );

    expect(
      getByRole('button', { name: 'Confirmar Presença' }).props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: true }));
  });
});
