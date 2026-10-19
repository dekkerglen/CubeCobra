import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import RecordsNavbar from 'components/records/RecordsNavbar';
import CubeContext from 'contexts/CubeContext';

// The "from draft" entry point opens a modal that pulls in the whole draft picker; not relevant
// to the create-record button under test.
jest.mock('components/modals/CreateRecordFromDraftModal', () => ({
  __esModule: true,
  default: () => <div />,
}));

const cube = { id: 'cube-1', shortId: 'cube-1', name: 'Test Cube' };

const renderNavbar = () =>
  render(
    <CubeContext.Provider value={{ cube, canEdit: true } as any}>
      <RecordsNavbar />
    </CubeContext.Provider>,
  );

describe('RecordsNavbar create-record button', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('leaves the record field empty until the button is pressed', () => {
    const { container } = renderNavbar();

    const recordInput = container.querySelector('input[name="record"]') as HTMLInputElement;
    expect(recordInput).toBeInTheDocument();
    expect(recordInput.value).toBe('');
  });

  it('builds the record payload at click time, not at render time', () => {
    const submit = jest.fn();
    // jsdom does not implement form submission.
    Object.defineProperty(HTMLFormElement.prototype, 'submit', {
      configurable: true,
      writable: true,
      value: submit,
    });

    const clickTime = new Date('2024-06-15T12:00:00Z');
    jest.useFakeTimers().setSystemTime(clickTime);

    const { container } = renderNavbar();
    const recordInput = container.querySelector('input[name="record"]') as HTMLInputElement;

    fireEvent.click(screen.getByRole('button', { name: /new record/i }));

    expect(submit).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(recordInput.value);
    expect(payload.date).toBe(clickTime.valueOf());
    expect(typeof payload.name).toBe('string');
    expect(payload.name.length).toBeGreaterThan(0);

    jest.useRealTimers();
  });

  it('uses the time of the click even when the page was rendered much earlier', () => {
    const submit = jest.fn();
    Object.defineProperty(HTMLFormElement.prototype, 'submit', {
      configurable: true,
      writable: true,
      value: submit,
    });

    // Render "yesterday" and click "today": the payload must carry the click time. The previous
    // implementation baked the render-time date into the hidden input, so a page left open
    // overnight created a record dated the day before.
    jest.useFakeTimers().setSystemTime(new Date('2024-06-14T23:00:00Z'));
    const { container } = renderNavbar();
    const recordInput = container.querySelector('input[name="record"]') as HTMLInputElement;

    const clickTime = new Date('2024-06-15T09:00:00Z');
    jest.setSystemTime(clickTime);
    fireEvent.click(screen.getByRole('button', { name: /new record/i }));

    expect(JSON.parse(recordInput.value).date).toBe(clickTime.valueOf());

    jest.useRealTimers();
  });
});
