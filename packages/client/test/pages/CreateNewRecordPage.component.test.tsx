import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import CreateNewRecordPage from '../../src/pages/CreateNewRecordPage';

jest.mock('components/RenderToRoot', () => ({ __esModule: true, default: (Component: any) => Component }));
jest.mock('layouts/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('layouts/CubeLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('components/DynamicFlash', () => ({ __esModule: true, default: () => null }));
jest.mock('components/TextEntry', () => ({
  __esModule: true,
  default: ({ value, setValue }: { value: string; setValue: (v: string) => void }) => (
    <textarea aria-label="Description" value={value} onChange={(e) => setValue(e.target.value)} />
  ),
}));

const cube = { id: 'cube-1', name: 'My Cube' } as unknown as Cube;

describe('CreateNewRecordPage', () => {
  // This wizard was two steps — name/description then a player list — and nothing linked to it,
  // which the design identifies as cause and effect: an organiser rarely knows the full player
  // list before the event starts, so the second step was skipped by going around the wizard
  // entirely. It now collects only what is known up front.
  it('collects name, description and date and nothing else', () => {
    render(<CreateNewRecordPage cube={cube} />);

    expect(screen.getByPlaceholderText('Enter a name for the record')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select a date for the record')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();

    // No second-step affordances: no player list, no "Next Step" / "Back" navigation.
    expect(screen.queryByText(/add a player/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/next step/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/back to step 1/i)).not.toBeInTheDocument();
  });

  it('submits without a second step', () => {
    const submit = jest.fn();
    Object.defineProperty(HTMLFormElement.prototype, 'submit', {
      configurable: true,
      writable: true,
      value: submit,
    });

    const { container } = render(<CreateNewRecordPage cube={cube} />);

    fireEvent.change(screen.getByPlaceholderText('Enter a name for the record'), {
      target: { value: 'Friday Night Draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(submit).toHaveBeenCalledTimes(1);
    const form = container.querySelector('form') as HTMLFormElement;
    expect(form).toHaveAttribute('action', '/cube/records/create/cube-1');
    const recordInput = form.querySelector('input[name="record"]') as HTMLInputElement;
    expect(JSON.parse(recordInput.value).name).toBe('Friday Night Draft');
  });

  it('refuses to submit without a name', () => {
    render(<CreateNewRecordPage cube={cube} />);

    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });
});
