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

  /**
   * The same wizard serves both entry points. Input Finished Event used to POST the moment it
   * was pressed, so a record existed before the organiser had typed anything — abandoning the
   * page it opened left an empty one behind, which the list had no way to show was empty.
   */
  describe('the finished-event path', () => {
    const nameField = () => screen.getByPlaceholderText('Enter a name for the record') as HTMLInputElement;
    const dateField = () => screen.getByPlaceholderText('Select a date for the record') as HTMLInputElement;

    it('posts to the route that lands in the workspace', () => {
      const { container } = render(<CreateNewRecordPage cube={cube} finished />);

      expect(screen.getByText('Input Finished Event')).toBeInTheDocument();
      expect(container.querySelector('form')).toHaveAttribute('action', '/cube/records/create/finished/cube-1');
    });

    // It replaced a single button that generated exactly these two values, so asking for them
    // again would have made the quicker path the slower one.
    it('arrives prefilled with a name and today', () => {
      render(<CreateNewRecordPage cube={cube} finished />);

      expect(nameField().value).toMatch(/^Draft on \d{1,2} \w+, \d{4}$/);
      expect(screen.getByRole('button', { name: /continue to event data/i })).not.toBeDisabled();
    });

    /**
     * The date input round-trips through UTC midnight, so a prefilled date has to be stored
     * that way or it reads back a day early. The name is built from the same local day, which
     * is what keeps the list's Name and Date columns agreeing.
     */
    it('prefills a date that reads back as the day it names', () => {
      render(<CreateNewRecordPage cube={cube} finished />);

      const now = new Date();
      const pad = (n: number) => `${n}`.padStart(2, '0');
      expect(dateField().value).toBe(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      expect(nameField().value).toContain(`${now.getDate()} `);
    });

    it('still starts an event empty, on the wizard route', () => {
      const { container } = render(<CreateNewRecordPage cube={cube} />);

      expect(screen.getByText('Start an Event')).toBeInTheDocument();
      expect(nameField().value).toBe('');
      expect(container.querySelector('form')).toHaveAttribute('action', '/cube/records/create/cube-1');
    });
  });
});
