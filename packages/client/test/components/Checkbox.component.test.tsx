import React, { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Checkbox from 'components/base/Checkbox';
import PagedTable from 'components/PagedTable';

describe('Checkbox', () => {
  it('treats a missing checked value as unchecked, staying controlled', () => {
    // Callers that read out of a sparse map (`checked[id]`) hand us undefined for anything
    // untouched. Undefined leaves the input uncontrolled, so the browser's own checked state
    // survives re-renders instead of following the caller's state.
    const props = { label: 'Fabled Passage', checked: undefined as unknown as boolean, setChecked: () => {} };
    const { rerender } = render(<Checkbox {...props} />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;

    fireEvent.click(input);
    rerender(<Checkbox {...props} />);

    expect(input.checked).toBe(false);
  });
});

const items = ['Ancestral Vision', 'Birds of Paradise', 'Counterspell', 'Dark Ritual'];

const PagedCheckboxes: React.FC = () => {
  const [checked, setChecked] = useState<{ [key: string]: boolean }>({});

  const rows = items.map((item) => ({
    Name: (
      <Checkbox
        label={item}
        checked={checked[item]}
        setChecked={() => setChecked((prev) => ({ ...prev, [item]: !prev[item] }))}
      />
    ),
  }));

  return <PagedTable pageSize={2} headers={['Name']} rows={rows} />;
};

describe('Checkbox inside a paged table', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('does not carry a selection onto the row that reuses its DOM node on the next page', () => {
    const { container } = render(<PagedCheckboxes />);

    fireEvent.click(screen.getByLabelText('Ancestral Vision'));
    expect((screen.getByLabelText('Ancestral Vision') as HTMLInputElement).checked).toBe(true);

    // Table keys rows by index, so the next page's first row renders into the same input element.
    fireEvent.click(container.querySelectorAll('button')[2]);

    expect(screen.getByLabelText('Counterspell')).not.toBeChecked();
    expect(screen.getByLabelText('Dark Ritual')).not.toBeChecked();
  });
});
