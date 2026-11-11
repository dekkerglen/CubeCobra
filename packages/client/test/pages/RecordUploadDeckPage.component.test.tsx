import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';

import { CSRFContext } from 'contexts/CSRFContext';

import { createCardDetails } from '../../../server/test/test-utils/data';
import RecordUploadDeckPage from '../../src/pages/RecordUploadDeckPage';

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
// The photo scanner opens a modal and talks to an image endpoint; neither is what this suite is
// about, and standing it in keeps these tests about the form's own state.
jest.mock('../../src/records/ScanDeckPhotoButton', () => ({ __esModule: true, default: () => null }));

const cube = { id: 'cube-1', name: 'My Cube' } as unknown as Cube;

const record: Record = {
  id: 'rec-1',
  cube: 'cube-1',
  date: 1700000000000,
  name: 'Tuesday Night',
  description: '',
  players: [{ name: 'Alice' }, { name: 'Bob' }],
  matches: [],
  trophy: [],
};

// Alice (seat 0) already has a deck; Bob (seat 1) does not. Selecting one or the other is what
// moves the form between two different reasons for a disabled Upload button.
const draft: Draft = {
  id: 'draft-1',
  cube: 'cube-1',
  type: DRAFT_TYPES.DRAFT,
  cards: [{ cardID: 'card-0', details: createCardDetails({ name: 'Lightning Bolt', oracle_id: 'oracle-bolt' }) }],
  seats: [
    { mainboard: [[[0]]], sideboard: [[[]]] },
    { mainboard: [[[]]], sideboard: [[[]]] },
  ],
} as unknown as Draft;

const renderPage = (initialPlayerIndex?: number) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <RecordUploadDeckPage cube={cube} record={record} draft={draft} initialPlayerIndex={initialPlayerIndex} />
    </CSRFContext.Provider>,
  );

const uploadButton = () => screen.getByRole('button', { name: 'Upload' });

/**
 * Why a disabled Upload button must always say why: the reason used to render in a dismissable
 * `Alert`, whose `visible` state is per-instance and is not reset when the message changes. One
 * dismissal therefore suppressed every later reason for the life of the page, leaving a dead
 * Upload button with nothing on screen explaining it.
 */
describe('RecordUploadDeckPage disabled-reason', () => {
  it('says why Upload is disabled', () => {
    renderPage(2);

    expect(uploadButton()).toBeDisabled();
    expect(screen.getByText('No cards added to mainboard')).toBeInTheDocument();
  });

  it('offers no way to dismiss the reason', () => {
    renderPage(2);

    const reason = screen.getByText('No cards added to mainboard');
    // The dismiss control was an unlabelled button inside the alert's coloured box. The reason
    // is plain text now — no control of its own, and not inside an Alert that could supply one.
    expect(reason.querySelector('button')).toBeNull();
    expect(reason.closest('.bg-yellow-100, .bg-red-100, .bg-blue-100, .bg-green-100')).toBeNull();
  });

  it('replaces the reason when a different one applies', () => {
    renderPage(2);

    expect(screen.getByText('No cards added to mainboard')).toBeInTheDocument();

    // Alice, at seat 0, already has a deck in the draft — a reason the uploader cannot guess
    // from a greyed-out button, and the one most worth never losing.
    fireEvent.change(screen.getByLabelText('Select Player'), { target: { value: '1' } });

    expect(screen.getByText('Selected player already has a deck in the draft')).toBeInTheDocument();
    expect(screen.queryByText('No cards added to mainboard')).not.toBeInTheDocument();
  });

  it('says nothing when no player is selected yet beyond asking for one', () => {
    renderPage();

    expect(uploadButton()).toBeDisabled();
    expect(screen.getByText('No player selected')).toBeInTheDocument();
  });
});
