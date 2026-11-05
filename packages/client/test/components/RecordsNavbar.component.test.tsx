import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import RecordsNavbar from 'components/records/RecordsNavbar';
import CubeContext from 'contexts/CubeContext';

// The "from draft" entry point opens a modal that pulls in the whole draft picker; not relevant
// to the entry-point controls under test.
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

describe('RecordsNavbar entry points', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('offers Start an Event and Input Finished Event in place of Create New Record', () => {
    renderNavbar();

    // "Create New Record" POSTed a blank record straight to the read-built record page; it has
    // been replaced entirely, not merely relabeled.
    expect(screen.queryByText('Create New Record')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start an event/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /input finished event/i })).toBeInTheDocument();
  });

  it('links Start an Event to the wizard rather than posting a blank record', () => {
    renderNavbar();

    // A link, not a form submission: the record is only created once the wizard's own form is
    // submitted, so navigating here and abandoning the wizard leaves nothing behind.
    const startLink = screen.getByRole('link', { name: /start an event/i });
    expect(startLink).toHaveAttribute('href', '/cube/records/create/cube-1');
  });

  it('leaves From Draft, Hedron, Import and Export untouched', () => {
    renderNavbar();

    // The "from draft" trigger is an onClick-only anchor (no href — it opens a modal rather than
    // navigating), so it carries no accessible "link" role; match on its visible text instead.
    expect(screen.getByText('Create from Draft')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /import from hedron network/i })).toHaveAttribute(
      'href',
      '/cube/records/hedron/cube-1',
    );
    expect(screen.getByRole('link', { name: /import from file/i })).toHaveAttribute(
      'href',
      '/cube/records/importfile/cube-1',
    );
    expect(screen.getByRole('link', { name: /export all records/i })).toHaveAttribute(
      'href',
      '/cube/records/export/cube-1',
    );
  });

  it('leaves the record field empty until Input Finished Event is pressed', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /input finished event/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /input finished event/i }));

    expect(JSON.parse(recordInput.value).date).toBe(clickTime.valueOf());

    jest.useRealTimers();
  });

  it('posts Input Finished Event to the finished-entry route, not the wizard route', () => {
    const { container } = renderNavbar();

    const form = container.querySelector('form') as HTMLFormElement;
    expect(form).toHaveAttribute('action', '/cube/records/create/finished/cube-1');
  });
});
