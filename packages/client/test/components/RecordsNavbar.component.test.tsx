import React from 'react';

import { render, screen } from '@testing-library/react';

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
    expect(screen.getByRole('link', { name: /input finished event/i })).toBeInTheDocument();
  });

  /**
   * Neither entry point creates anything when pressed. Input Finished Event used to POST on
   * click, so a record existed the moment it was pressed — abandoning the page it opened left
   * an empty one behind, and the list had no way to show it was empty. Both now open the same
   * wizard, whose own form is what creates the record.
   */
  it('creates nothing on click: both entry points are links, and the navbar posts no form', () => {
    const { container } = renderNavbar();

    expect(screen.getByRole('link', { name: /start an event/i })).toHaveAttribute(
      'href',
      '/cube/records/create/cube-1',
    );
    expect(screen.getByRole('link', { name: /input finished event/i })).toHaveAttribute(
      'href',
      '/cube/records/create/finished/cube-1',
    );
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input[name="record"]')).toBeNull();
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

  // Six identical links in one row said nothing about which of them a reader wanted.
  it('groups the ways to add a record by what they start from', () => {
    renderNavbar();

    // The label renders inside a ResponsiveDiv, so the group itself is one level up.
    const newEvent = screen.getByText('New event').closest('div')!.parentElement!;
    expect(newEvent).toHaveTextContent('Start an Event');
    expect(newEvent).toHaveTextContent('Input Finished Event');

    const fromExisting = screen.getByText('From existing').closest('div')!.parentElement!;
    expect(fromExisting).toHaveTextContent('Create from Draft');
    expect(fromExisting).toHaveTextContent('Import from Hedron Network');
    expect(fromExisting).toHaveTextContent('Import from File');
    // Exporting is not a way to add a record, so it is in neither group.
    expect(fromExisting).not.toHaveTextContent('Export All Records');
    expect(newEvent).not.toHaveTextContent('Export All Records');
  });
});
