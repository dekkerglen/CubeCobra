import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';

import CubeContext from 'contexts/CubeContext';

import { createCardDetails } from '../../../server/test/test-utils/data';
import RecordPage from '../../src/pages/RecordPage';

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
jest.mock('components/comments/CommentsSection', () => ({ __esModule: true, default: () => null }));
jest.mock('components/Markdown', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
  SafeMarkdown: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));
// DeckCard's own rendering (card grids, pick breakdowns, autocard previews) is unrelated to
// this page's edit controls and is exercised elsewhere; standing in for it keeps these tests
// about who can open what, not about deck rendering.
jest.mock('components/DeckCard', () => ({ __esModule: true, default: () => <div data-testid="deck-card" /> }));

// The Decks, Standings and Matches tabs are deliberately NOT mocked here (unlike the heavier,
// unrelated pieces above): this suite exists to prove the overview/player-list/override
// controls this task removes are gone while everything the tabs still offer (rounds,
// trophies, deck removal/upload) keeps working, and a mock stand-in could not tell the
// difference between "still there" and "quietly deleted".

const cube = { id: 'cube-1', name: 'My Cube' } as unknown as Cube;

const baseRecord: Record = {
  id: 'rec-1',
  cube: 'cube-1',
  date: 1700000000000,
  name: 'Tuesday Night',
  description: 'Eight players, three rounds',
  players: [{ name: 'Alice' }, { name: 'Bob' }],
  matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [1, 0, 0] }] }],
  trophy: [],
};

const emptyPlayersRecord: Record = {
  ...baseRecord,
  players: [],
  matches: [],
};

// Alice's seat carries a deck, Bob's does not — exercises both the "has a deck" controls
// (remove/edit/export) and the "no deck yet" upload prompt from the same fixture.
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

const renderPage = (canEdit: boolean, record: Record = baseRecord, withDraft: Draft | undefined = draft) =>
  render(
    <CubeContext.Provider value={{ cube, canEdit } as any}>
      <RecordPage cube={cube} record={record} draft={withDraft} players={[]} />
    </CubeContext.Provider>,
  );

const openDeckMenu = () => fireEvent.click(screen.getByText('More'));

describe('RecordPage', () => {
  // The active tab lives in the URL (useQueryParam), which persists in jsdom across tests in
  // this file unless reset — otherwise a tab switch in one test leaks into the next test's
  // initial render.
  beforeEach(() => {
    window.history.replaceState({}, '', '/cube/record/rec-1');
  });

  // The design asks for this to be visible from every tab rather than buried in one, so it
  // sits above the tab strip and survives switching tabs.
  it('offers the transcription workspace from every tab', () => {
    renderPage(true);

    const transcribeLink = () => screen.queryByRole('link', { name: 'Enter event data' });

    expect(transcribeLink()).toHaveAttribute('href', '/cube/records/enter/rec-1');

    fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
    expect(transcribeLink()).toHaveAttribute('href', '/cube/records/enter/rec-1');

    fireEvent.click(screen.getByRole('button', { name: 'Standings' }));
    expect(transcribeLink()).toHaveAttribute('href', '/cube/records/enter/rec-1');
  });

  it('offers no overview, player-list or override editing to an owner', () => {
    renderPage(true);

    // Overview: the edit link is gone, but the overview content itself still renders.
    expect(screen.queryByText('Edit overview')).not.toBeInTheDocument();
    expect(screen.getByText('Tuesday Night')).toBeInTheDocument();

    // Player list: the bare "Edit" link next to the "Players" heading is gone, but the
    // heading and the roster itself still render.
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);

    // Override: the player's record is no longer a clickable control, but the figure
    // itself is still shown as plain text.
    expect(screen.queryByRole('button', { name: /^Record: /i })).not.toBeInTheDocument();
    expect(screen.getByText(/^Record: /i)).toBeInTheDocument();
  });

  it('offers no "add players" entry point to an owner of an empty roster', () => {
    renderPage(true, emptyPlayersRecord, undefined);

    expect(screen.queryByText('Add players')).not.toBeInTheDocument();
    expect(screen.getByText('No players have been added to this record yet.')).toBeInTheDocument();
  });

  it('still offers add/edit/remove round, assign trophies, remove deck and upload deck', () => {
    renderPage(true);

    // Upload a deck (sidebar, always offered to an owner).
    expect(screen.getByRole('link', { name: 'Upload a deck' })).toHaveAttribute(
      'href',
      '/cube/records/uploaddeck/rec-1?player=1',
    );

    // Remove Deck lives behind the per-deck "More" menu.
    openDeckMenu();
    expect(screen.getByText('Remove Deck')).toBeInTheDocument();

    // Matches tab: add a round is always offered; edit/remove round are offered per round.
    fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
    expect(screen.getByText('Add a new round of matches to this record')).toBeInTheDocument();
    expect(screen.getByText('Edit Round')).toBeInTheDocument();
    expect(screen.getByText('Remove Round')).toBeInTheDocument();

    // Standings tab: assign trophies.
    fireEvent.click(screen.getByRole('button', { name: 'Standings' }));
    expect(screen.getByText('Assign Trophies')).toBeInTheDocument();
  });

  it('still offers the share link and Enter event data', () => {
    renderPage(true);

    expect(screen.getByText('Share link to collect decks')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enter event data' })).toHaveAttribute('href', '/cube/records/enter/rec-1');
  });

  it('offers none of them to a non-owner', () => {
    renderPage(false);

    expect(screen.queryByText('Edit overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Record: /i })).not.toBeInTheDocument();
    expect(screen.queryByText('Share link to collect decks')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Enter event data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Upload a deck' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
    expect(screen.queryByText('Add a new round of matches to this record')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Standings' }));
    expect(screen.queryByText('Assign Trophies')).not.toBeInTheDocument();
  });
});
