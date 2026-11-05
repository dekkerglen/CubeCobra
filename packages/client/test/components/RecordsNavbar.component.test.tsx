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

  /**
   * Three ways to build a record from something you already have, each rarer than the two ways
   * to start one from nothing. In the row they made six undifferentiated links out of what is
   * really two choices and a menu.
   */
  it('puts the ways to build from an existing event behind one menu', () => {
    renderNavbar();

    expect(screen.queryByText('Create from Draft')).not.toBeInTheDocument();
    expect(screen.queryByText('Import from Hedron Network')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('From an existing event'));

    expect(screen.getByText('Create from Draft')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import from Hedron Network' })).toHaveAttribute(
      'href',
      '/cube/records/hedron/cube-1',
    );
    expect(screen.getByRole('link', { name: 'Import from File' })).toHaveAttribute(
      'href',
      '/cube/records/importfile/cube-1',
    );
  });

  // Exporting acts on the list, not on this row of ways to add to it, so it moved into the
  // list's own header.
  it('offers no export, which belongs to the list', () => {
    renderNavbar();

    expect(screen.queryByText(/export/i)).not.toBeInTheDocument();
  });

  // Every control here needs edit rights, so a reader gets no row at all rather than an empty
  // one where six links used to be.
  it('renders nothing for someone who cannot edit the cube', () => {
    const { container } = render(
      <CubeContext.Provider value={{ cube, canEdit: false } as any}>
        <RecordsNavbar />
      </CubeContext.Provider>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
