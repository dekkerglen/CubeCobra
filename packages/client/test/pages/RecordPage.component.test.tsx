import React from 'react';

import { act, fireEvent, render, screen, within } from '@testing-library/react';

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
// about who can open what, not about deck rendering. `deckPiles` is kept real — the Decks tab
// uses it to decide which players actually have a deck, which several tests below depend on —
// and `DeckStacksStatic` (the Full Draft tab's per-deck card grid) gets the same lightweight
// treatment as the single-deck `DeckCard` default export, for the same reason.
jest.mock('components/DeckCard', () => ({
  __esModule: true,
  default: () => <div data-testid="deck-card" />,
  deckPiles: jest.requireActual('components/DeckCard').deckPiles,
  DeckStacksStatic: () => <div data-testid="deck-stacks" />,
}));

// The Players, Matches, Decks and Standings tabs are deliberately NOT mocked here (unlike the
// heavier, unrelated pieces above): this suite exists to prove the overview/player-list/override
// controls a prior task removed are gone, that this task's Players/Decks split is real (no
// leftover By Player/Full Draft toggle, each tab reachable on its own), and that everything the
// tabs still offer (rounds, trophies, deck removal/upload, adding players) keeps working. A mock
// stand-in could not tell the difference between "still there" and "quietly deleted".

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

// Review Focus 4: a match can reference a player no longer in record.players (removed via the
// transcription workspace, which owns removal). The record page must still render their name
// as plain text rather than crash.
const recordWithRemovedPlayerMatch: Record = {
  ...baseRecord,
  matches: [...baseRecord.matches, { matches: [{ p1: 'Alice', p2: 'Carol', results: [1, 0, 0] }] }],
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

// Both seats carry a deck, for the one test that needs a second player to switch to.
const bothDecksDraft: Draft = {
  ...draft,
  id: 'draft-2',
  seats: [
    { mainboard: [[[0]]], sideboard: [[[]]] },
    { mainboard: [[[0]]], sideboard: [[[]]] },
  ],
};

// A third argument of `undefined` is indistinguishable from omitting it under JS default
// parameters, so "explicitly no draft" uses `null` instead — otherwise a call meaning "no
// draft" would silently fall back to the default draft fixture.
const renderPage = (canEdit: boolean, record: Record = baseRecord, withDraft: Draft | null | undefined = draft) =>
  render(
    <CubeContext.Provider value={{ cube, canEdit } as any}>
      <RecordPage cube={cube} record={record} draft={withDraft ?? undefined} players={[]} />
    </CubeContext.Provider>,
  );

const openDeckMenu = () => fireEvent.click(screen.getByText('More'));

/**
 * "View deck" (RecordAllDecks) is a Link used as a button — onClick only, no href — which is
 * the established pattern this codebase uses for an anchor-styled action (SampleHandLink,
 * RemoveDeckLink, the "More" menu trigger, ...). jsdom's `_cannotNavigate` check never looks at
 * whether an `<a>` actually has an href, so clicking one still schedules a same-page
 * "navigation" and logs it as unimplemented. Swallow that one message (as this codebase already
 * does in overviewEditingSurfaces.component.test.tsx) and let every other error through.
 */
let consoleError: jest.SpyInstance;

beforeAll(() => {
  const original = console.error.bind(console);
  consoleError = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
    if (args[0]?.type === 'not implemented') return;
    original(...args);
  });
});

afterAll(() => consoleError.mockRestore());

// Opens the Add Players modal and stages each name in turn via EditPlayerList's own resolver,
// so a test can assert on the single combined payload without ever clicking the final submit
// (which would call the real, jsdom-unimplemented HTMLFormElement.submit()). Each stage is
// wrapped in its own `act`: resolving a name is async (so a later `@handle` lookup can hit the
// network), and the resulting state update happens after the handler's first `await`, outside
// the implicit act() a plain fireEvent provides.
const stagePlayers = async (names: string[]) => {
  fireEvent.click(screen.getByRole('button', { name: 'Add Players' }));
  const input = screen.getByPlaceholderText('Enter player name (prefix with @ to link an account)');
  for (const name of names) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      fireEvent.change(input, { target: { value: name } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));
    });
  }
};

const stagedPlayersPayload = () =>
  JSON.parse((document.querySelector('input[name="players"]') as HTMLInputElement).value);
const stagedSeatOrderPayload = () =>
  JSON.parse((document.querySelector('input[name="seatOrder"]') as HTMLInputElement).value);

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

    const editRecordLink = () => screen.queryByRole('link', { name: 'Edit Record' });

    expect(editRecordLink()).toHaveAttribute('href', '/cube/records/enter/rec-1');

    fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
    expect(editRecordLink()).toHaveAttribute('href', '/cube/records/enter/rec-1');

    fireEvent.click(screen.getByRole('button', { name: 'Standings' }));
    expect(editRecordLink()).toHaveAttribute('href', '/cube/records/enter/rec-1');
  });

  it('offers no overview, player-list or override editing to an owner', () => {
    renderPage(true);

    // Overview: the edit link is gone, but the overview content itself still renders.
    expect(screen.queryByText('Edit overview')).not.toBeInTheDocument();
    expect(screen.getByText('Tuesday Night')).toBeInTheDocument();

    // Player list: the bare "Edit" link next to the "Players" heading is gone (replaced by
    // "Add Players", a different action with a different name), but the heading and the
    // roster itself still render. "Players" also names the tab itself, so there are two.
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.getAllByText('Players').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);

    // Override: the player's record is no longer a clickable control, but the figure
    // itself is still shown as plain text.
    expect(screen.queryByRole('button', { name: /^Record: /i })).not.toBeInTheDocument();
    expect(screen.getByText(/^Record: /i)).toBeInTheDocument();
  });

  it('still offers add/edit/remove round, assign trophies, remove deck and upload deck', () => {
    renderPage(true);

    // Upload a deck (sidebar, always offered to an owner, naming the selected player).
    expect(screen.getByRole('link', { name: 'Upload a deck for Alice' })).toHaveAttribute(
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

    expect(screen.getByText('Collect Decks')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit Record' })).toHaveAttribute('href', '/cube/records/enter/rec-1');
  });

  it('names the share action Collect Decks', () => {
    renderPage(true);

    expect(screen.getByText('Collect Decks')).toBeInTheDocument();
  });

  it('offers Edit Record in the menu rather than Enter event data above the tabs', () => {
    renderPage(true);

    expect(screen.getByRole('link', { name: 'Edit Record' })).toHaveAttribute('href', '/cube/records/enter/rec-1');
    expect(screen.queryByRole('link', { name: 'Enter event data' })).not.toBeInTheDocument();
  });

  it('aligns Collect Decks, Export and Edit Record to the right', () => {
    renderPage(true);

    const collectDecksLink = screen.getByText('Collect Decks');
    const exportLink = screen.getByRole('link', { name: 'Export' });
    const editRecordLink = screen.getByRole('link', { name: 'Edit Record' });

    expect(collectDecksLink).toBeInTheDocument();
    expect(exportLink).toBeInTheDocument();
    expect(editRecordLink).toBeInTheDocument();

    const collectDecksParent = collectDecksLink.closest('[class*="flex"]') || collectDecksLink.parentElement;
    const exportParent = exportLink.closest('[class*="flex"]') || exportLink.parentElement;
    const editRecordParent = editRecordLink.closest('[class*="flex"]') || editRecordLink.parentElement;

    expect(collectDecksParent).toBe(exportParent);
    expect(exportParent).toBe(editRecordParent);
  });

  it('offers a non-owner Export but neither Collect Decks nor Edit Record', () => {
    renderPage(false);

    expect(screen.queryByText('Collect Decks')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit Record' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Export' })).toBeInTheDocument();
  });

  it('offers none of them to a non-owner', () => {
    renderPage(false);

    expect(screen.queryByText('Edit overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Record: /i })).not.toBeInTheDocument();
    expect(screen.queryByText('Collect Decks')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit Record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Upload a deck for Alice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Players' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
    expect(screen.queryByText('Add a new round of matches to this record')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Standings' }));
    expect(screen.queryByText('Assign Trophies')).not.toBeInTheDocument();
  });

  it('orders the tabs players, matches, decks, standings', () => {
    renderPage(true);

    // All four tab buttons are siblings in one strip, so their DOM order is the display order.
    const tabStrip = screen.getByRole('button', { name: 'Players' }).parentElement!;
    expect(tabStrip.textContent).toBe('PlayersMatchesDecksStandings');
  });

  it('shows the player list with each deck and record on the Players tab', () => {
    renderPage(true);

    // Alice appears twice: once in the roster pill, once as the selected player's heading.
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // Alice 1-0, Bob 0-1, from the single match in baseRecord.
    expect(screen.getByText('1-0')).toBeInTheDocument();
    expect(screen.getByText('0-1')).toBeInTheDocument();
    // Alice has a deck and is the default selection, so her deck renders inline.
    expect(screen.getByTestId('deck-card')).toBeInTheDocument();
  });

  it('shows the full draft on the Decks tab', () => {
    renderPage(true);
    fireEvent.click(screen.getByRole('button', { name: 'Decks' }));

    // The Players tab stays mounted (just hidden) when switching tabs, so Alice's name from
    // there is still in the document; "View deck" and "No deck yet: Bob" are unique to the
    // Full Draft view, so their presence is what actually proves this tab, not the other one,
    // is what's showing.
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getByText('View deck')).toBeInTheDocument();
    expect(screen.getByText('No deck yet: Bob')).toBeInTheDocument();
  });

  it('says the Decks tab has nothing to show when the record has no draft', () => {
    // Review Focus 5
    renderPage(true, baseRecord, null);
    fireEvent.click(screen.getByRole('button', { name: 'Decks' }));

    // The Players tab (still mounted, just hidden) says the same thing about itself, so this
    // checks for at least one rather than exactly one.
    expect(screen.getAllByText('No draft data available for this record.').length).toBeGreaterThan(0);
  });

  it('offers no By Player / Full Draft switch anywhere', () => {
    renderPage(true);
    fireEvent.click(screen.getByRole('button', { name: 'Decks' }));

    expect(screen.queryByText('By player')).not.toBeInTheDocument();
    expect(screen.queryByText('Full draft')).not.toBeInTheDocument();
  });

  it('moves to the Players tab with that player selected from View deck', () => {
    renderPage(true, baseRecord, bothDecksDraft);
    fireEvent.click(screen.getByRole('button', { name: 'Decks' }));

    // Alice's deck block is first, so Bob's "View deck" is the second one.
    fireEvent.click(screen.getAllByText('View deck')[1]);

    expect(window.location.search).toBe('?tab=players');
    // "Edit Deck" links at the seat index of whoever is selected, so this pins down that Bob
    // (seat 1), not Alice (the tab's usual default), is now showing.
    expect(screen.getByRole('link', { name: 'Edit Deck' })).toHaveAttribute(
      'href',
      '/draft/deckbuilder/draft-2?seat=1',
    );
  });

  it('gives an owner a prominent Add Player action on the Players tab', () => {
    renderPage(true);

    expect(screen.getByRole('button', { name: 'Add Players' })).toBeInTheDocument();
  });

  it('points the no-players empty state at Add Player rather than a deck upload', () => {
    renderPage(true, emptyPlayersRecord, null);

    expect(screen.getByText('No players have been added to this record yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Players' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /upload a deck/i })).not.toBeInTheDocument();
  });

  it('gives the deck upload links one name naming the player', () => {
    renderPage(true);
    // Bob has no deck, so both the sidebar link and the empty-state link show at once.
    fireEvent.click(screen.getByText('Bob'));

    const links = screen.getAllByRole('link', { name: 'Upload a deck for Bob' });
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/cube/records/uploaddeck/rec-1?player=2'));
  });

  it('offers no rename, reorder or remove on the Players tab', () => {
    renderPage(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add Players' }));

    const dialog = screen.getByRole('dialog');
    // The existing roster is never loaded into this editor — only names staged in this
    // session appear — so there is nothing of it to rename, reorder or remove from here.
    // That gap (loading the full roster, so a reorder could re-seat someone's deck) is what
    // sank the modal this replaces.
    expect(within(dialog).queryByText('Alice')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Bob')).not.toBeInTheDocument();
  });

  it('stages several players and commits them in one save', async () => {
    renderPage(true);

    await stagePlayers(['Carol', 'Dave', 'Eve']);

    // One combined payload for all three — not one submission per name.
    expect(stagedPlayersPayload().map((player: { name: string }) => player.name)).toEqual([
      'Alice',
      'Bob',
      'Carol',
      'Dave',
      'Eve',
    ]);
  });

  it('appends the staged players to the existing list rather than replacing it', async () => {
    renderPage(true);

    await stagePlayers(['Carol']);

    const players = stagedPlayersPayload();
    expect(players).toHaveLength(3);
    expect(players[0]).toMatchObject({ name: 'Alice' });
    expect(players[1]).toMatchObject({ name: 'Bob' });
    expect(players[2]).toMatchObject({ name: 'Carol' });
  });

  it('marks every appended player as new in seatOrder so no existing deck moves', async () => {
    renderPage(true);

    await stagePlayers(['Carol', 'Dave']);

    // Identity for Alice and Bob (seats 0 and 1, untouched), -1 for each appended player.
    expect(stagedSeatOrderPayload()).toEqual([0, 1, -1, -1]);
  });

  it('keeps a match referencing a player who was removed', () => {
    renderPage(true, recordWithRemovedPlayerMatch);
    fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

    expect(screen.getByText('Carol')).toBeInTheDocument();
  });

  // The tabs moved from `?tab=<index>` to `?tab=<slug>` so a later reorder can't silently
  // repoint every hardcoded server redirect. These markers are each unique to one tab's
  // content so a wrong-tab-shown bug can't hide behind a false positive: "deck-card" only
  // comes from the Players tab's single-deck view, "Round 1" only from RecordMatches, and
  // "Losses" is a standings table header no other tab's table uses.
  describe('tab addressing by name', () => {
    it('opens the tab named in the query', () => {
      window.history.replaceState({}, '', '/cube/record/rec-1?tab=matches');
      renderPage(true);

      expect(screen.getByText('Round 1')).toBeInTheDocument();
      expect(screen.queryByTestId('deck-card')).not.toBeInTheDocument();
    });

    it('falls back to the first tab for an unrecognised name', () => {
      window.history.replaceState({}, '', '/cube/record/rec-1?tab=nonsense');
      renderPage(true);

      expect(screen.getByTestId('deck-card')).toBeInTheDocument();
    });

    it('falls back to the first tab for an old numeric bookmark', () => {
      // Review Focus 1: a numeric `?tab=` value is from before tabs were addressed by name,
      // when it happened to coincide with whichever tab sat at that position. A slug is
      // required now, so this unrecognised value must fall back to the first tab rather than
      // resolving to some tab by coincidence of the old order.
      window.history.replaceState({}, '', '/cube/record/rec-1?tab=2');
      renderPage(true);

      expect(screen.getByTestId('deck-card')).toBeInTheDocument();
      expect(screen.queryByText('Round 1')).not.toBeInTheDocument();
    });

    it('falls back to the first tab when tab is absent', () => {
      renderPage(true);

      expect(screen.getByTestId('deck-card')).toBeInTheDocument();
    });

    it('writes the slug, not an index, when a tab is clicked', () => {
      renderPage(true);

      fireEvent.click(screen.getByRole('button', { name: 'Standings' }));

      expect(screen.getByText('Losses')).toBeInTheDocument();
      expect(window.location.search).toBe('?tab=standings');
    });
  });
});
