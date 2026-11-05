import React from 'react';

import { act, fireEvent, render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';

import { CSRFContext } from 'contexts/CSRFContext';
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

// No rounds at all — the control above the (empty) list reads "Start the event" rather than
// "Add Round", since there is no status field behind it: the label is purely a function of
// matches.length.
const noRoundsRecord: Record = {
  ...baseRecord,
  matches: [],
};

// Two rounds between two different pairs, so the latest round's row and the earlier round's
// (collapsed) summary can never be confused for each other by shared player names.
const twoRoundRecord: Record = {
  ...baseRecord,
  players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }, { name: 'Dave' }],
  matches: [
    { matches: [{ p1: 'Alice', p2: 'Bob', results: [1, 0, 0] }] },
    { matches: [{ p1: 'Carol', p2: 'Dave', results: [0, 1, 0] }] },
  ],
};

// One round, two matches between two different pairs — reporting the second must not touch
// the first, so the endpoint payload (and the row left behind) can be checked for carrying
// exactly one match, named unambiguously.
const twoMatchRoundRecord: Record = {
  ...baseRecord,
  players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }, { name: 'Dave' }],
  matches: [
    {
      matches: [
        { p1: 'Alice', p2: 'Bob', results: [1, 0, 0] },
        { p1: 'Carol', p2: 'Dave', results: [0, 1, 0] },
      ],
    },
  ],
};

// One round, three matches between three different pairs — wide enough to put a failed
// match between two others, so removing one of the others can be checked for whether the
// failure indicator follows the match that actually failed or drifts to whichever row the
// removal happens to shift into its old index.
const threeMatchRoundRecord: Record = {
  ...baseRecord,
  players: [
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Carol' },
    { name: 'Dave' },
    { name: 'Eve' },
    { name: 'Frank' },
  ],
  matches: [
    {
      matches: [
        { p1: 'Alice', p2: 'Bob', results: [1, 0, 0] },
        { p1: 'Carol', p2: 'Dave', results: [0, 1, 0] },
        { p1: 'Eve', p2: 'Frank', results: [0, 0, 0] },
      ],
    },
  ],
};

// Two rounds, the second with two matches — for checking that a removal in one round never
// touches a pending failure indicator that belongs to a different round.
const twoRoundMultiMatchRecord: Record = {
  ...baseRecord,
  players: [
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Carol' },
    { name: 'Dave' },
    { name: 'Eve' },
    { name: 'Frank' },
  ],
  matches: [
    { matches: [{ p1: 'Alice', p2: 'Bob', results: [1, 0, 0] }] },
    {
      matches: [
        { p1: 'Carol', p2: 'Dave', results: [0, 1, 0] },
        { p1: 'Eve', p2: 'Frank', results: [0, 0, 0] },
      ],
    },
  ],
};

// A round opened on a record with no players yet: every seat in it must still offer a
// fillable option ("Unknown Opponent") rather than an empty, unusable select.
const noPlayersWithRoundRecord: Record = {
  ...baseRecord,
  players: [],
  matches: [{ matches: [{ p1: 'Unknown Opponent', p2: 'Unknown Opponent', results: [0, 0, 0] }] }],
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

// Answers any of the matches console's three endpoints with a generic success and no round,
// for tests that render the Matches tab without caring what it posts. Tests that do care
// (the commit tests below) pass their own mock in instead.
const defaultCsrfFetch = () =>
  jest.fn(async () => ({ ok: true, json: async () => ({ success: 'true' }) }) as unknown as Response);

// A third argument of `undefined` is indistinguishable from omitting it under JS default
// parameters, so "explicitly no draft" uses `null` instead — otherwise a call meaning "no
// draft" would silently fall back to the default draft fixture.
const renderPage = (
  canEdit: boolean,
  record: Record = baseRecord,
  withDraft: Draft | null | undefined = draft,
  csrfFetch: jest.Mock = defaultCsrfFetch(),
) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <CubeContext.Provider value={{ cube, canEdit } as any}>
        <RecordPage cube={cube} record={record} draft={withDraft ?? undefined} players={[]} />
      </CubeContext.Provider>
    </CSRFContext.Provider>,
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

  it('still offers add/remove round, assign trophies, remove deck and upload deck', () => {
    renderPage(true);

    // Upload a deck (sidebar, always offered to an owner, naming the selected player).
    expect(screen.getByRole('link', { name: 'Upload a deck for Alice' })).toHaveAttribute(
      'href',
      '/cube/records/uploaddeck/rec-1?player=1',
    );

    // Remove Deck lives behind the per-deck "More" menu.
    openDeckMenu();
    expect(screen.getByText('Remove Deck')).toBeInTheDocument();

    // Matches tab: adding a round (here labelled "Add Round", since one already exists) and
    // removing one are still offered. There is no whole-round "Edit Round" any more — editing
    // is per match, inline, below.
    fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
    expect(screen.getByRole('button', { name: 'Add Round' })).toBeInTheDocument();
    expect(screen.getByText('Remove Round')).toBeInTheDocument();
    expect(screen.queryByText('Edit Round')).not.toBeInTheDocument();

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
    expect(screen.queryByRole('button', { name: 'Add Round' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start the event' })).not.toBeInTheDocument();
    expect(screen.queryByText('Remove Round')).not.toBeInTheDocument();

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

    // Carol is still selectable (both player selects of the round that references her offer
    // her as an option, even though only one of them has her picked), so there is more than
    // one place her name now renders — the point is that it renders at all, not a crash.
    expect(screen.getAllByText('Carol').length).toBeGreaterThan(0);
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

  // The matches console: an inline replacement for the three Add/Edit/Remove Round modal
  // links, so reporting one result costs the organiser one field change rather than a modal
  // open, a form submit and a page reload.
  describe('matches console', () => {
    // Scopes a query to the row containing the given labelled control (e.g. 'Eve Wins'), so
    // the per-row "not saved" indicator can be checked to be attached to one row and not
    // another, rather than merely present somewhere on the page.
    const matchRowFor = (label: string) => screen.getByLabelText(label).closest('.flex-col') as HTMLElement;

    it('offers Start the event when the record has no rounds', () => {
      renderPage(true, noRoundsRecord);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      // The label is a function of matches.length, not a stored status — there is none.
      expect(screen.getByRole('button', { name: 'Start the event' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add Round' })).not.toBeInTheDocument();
    });

    it('offers Add Round once a round exists', () => {
      renderPage(true, baseRecord);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      expect(screen.getByRole('button', { name: 'Add Round' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Start the event' })).not.toBeInTheDocument();
    });

    it('expands the latest round and collapses the earlier ones', () => {
      renderPage(true, twoRoundRecord);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      // Round 2 (latest) starts expanded: its row controls are already on the page.
      expect(screen.getByLabelText('Carol Wins')).toBeInTheDocument();
      expect(screen.getByLabelText('Dave Wins')).toBeInTheDocument();

      // Round 1 starts collapsed: a summary, no row controls for its match.
      expect(screen.queryByLabelText('Alice Wins')).not.toBeInTheDocument();
      expect(screen.getByText('1 match')).toBeInTheDocument();

      // Expanding it reveals the same row controls the latest round already shows.
      fireEvent.click(screen.getByRole('button', { name: 'Expand Round 1' }));
      expect(screen.getByLabelText('Alice Wins')).toBeInTheDocument();
    });

    it('commits a reported result without a modal or a reload', async () => {
      const csrfFetch = jest.fn(
        async (_url?: RequestInfo, _init?: RequestInit) =>
          ({ ok: true, json: async () => ({ success: 'true' }) }) as unknown as Response,
      );
      renderPage(true, baseRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Alice Wins'), { target: { value: '2' } });
      });

      expect(csrfFetch).toHaveBeenCalledWith(
        '/cube/records/edit/match/set/rec-1',
        expect.objectContaining({ method: 'POST' }),
      );
      const [, init] = csrfFetch.mock.calls[0];
      expect(JSON.parse(init!.body as string)).toEqual({
        roundIndex: 0,
        matchIndex: 0,
        match: { p1: 'Alice', p2: 'Bob', results: [2, 0, 0] },
      });
      // No modal opened, and no form submission was attempted to reload the page.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('commits a pairing change the same way', async () => {
      const csrfFetch = jest.fn(
        async (_url?: RequestInfo, _init?: RequestInit) =>
          ({ ok: true, json: async () => ({ success: 'true' }) }) as unknown as Response,
      );
      renderPage(true, baseRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Player 2'), { target: { value: 'Unknown Opponent' } });
      });

      const [, init] = csrfFetch.mock.calls[0];
      expect(JSON.parse(init!.body as string)).toEqual({
        roundIndex: 0,
        matchIndex: 0,
        match: { p1: 'Alice', p2: 'Unknown Opponent', results: [1, 0, 0] },
      });
    });

    it('adds and removes a match within an open round', async () => {
      const csrfFetch = jest.fn(async (url: RequestInfo, _init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/add/')) {
          return {
            ok: true,
            json: async () => ({
              success: 'true',
              round: {
                matches: [
                  { p1: 'Alice', p2: 'Bob', results: [1, 0, 0] },
                  { p1: 'Unknown Opponent', p2: 'Unknown Opponent', results: [0, 0, 0] },
                ],
              },
            }),
          } as unknown as Response;
        }
        return {
          ok: true,
          json: async () => ({ success: 'true', round: { matches: [{ p1: 'Alice', p2: 'Bob', results: [1, 0, 0] }] } }),
        } as unknown as Response;
      });
      renderPage(true, baseRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add Match' }));
      });

      expect(csrfFetch).toHaveBeenCalledWith('/cube/records/edit/match/add/rec-1', expect.anything());
      const addCall = csrfFetch.mock.calls.find(([url]) => typeof url === 'string' && url.includes('/add/'))!;
      expect(JSON.parse(addCall[1]!.body as string)).toEqual({ roundIndex: 0 });

      // The added match's row is now on the page, and removing it posts matchIndex 1.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove match 2' }));
      });

      const removeCall = csrfFetch.mock.calls.find(([url]) => typeof url === 'string' && url.includes('/remove/'))!;
      expect(JSON.parse(removeCall[1]!.body as string)).toEqual({ roundIndex: 0, matchIndex: 1 });
    });

    it('leaves other matches alone when one is reported', async () => {
      const csrfFetch = jest.fn(
        async (_url?: RequestInfo, _init?: RequestInit) =>
          ({ ok: true, json: async () => ({ success: 'true' }) }) as unknown as Response,
      );
      renderPage(true, twoMatchRoundRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Carol Wins'), { target: { value: '3' } });
      });

      // Exactly the second match is carried, naming its own index — not the whole round
      // and not the first match, which never moved.
      const [, init] = csrfFetch.mock.calls[0];
      expect(JSON.parse(init!.body as string)).toEqual({
        roundIndex: 0,
        matchIndex: 1,
        match: { p1: 'Carol', p2: 'Dave', results: [3, 1, 0] },
      });
    });

    // A failed commit must never be indistinguishable from a successful one: a rejected
    // request, a non-ok response, and a success:'false' body all have to surface the same
    // per-row "didn't save" signal, and none of them may roll the typed value back off screen
    // or escape as an unhandled rejection (the suite would fail loudly on that by itself).
    it('surfaces a not-saved indication and does not throw when csrfFetch rejects', async () => {
      const csrfFetch = jest.fn(async () => {
        throw new Error('network down');
      });
      renderPage(true, baseRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Alice Wins'), { target: { value: '2' } });
      });

      expect(screen.getByRole('alert')).toHaveTextContent('Not saved');
    });

    it('surfaces the same not-saved indication for a non-ok or success:false response', async () => {
      const csrfFetch = jest.fn(
        async () => ({ ok: false, json: async () => ({ success: 'false' }) }) as unknown as Response,
      );
      renderPage(true, baseRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Alice Wins'), { target: { value: '2' } });
      });

      expect(screen.getByRole('alert')).toHaveTextContent('Not saved');
    });

    it('keeps the typed value on screen after a failed commit', async () => {
      const csrfFetch = jest.fn(async () => {
        throw new Error('network down');
      });
      renderPage(true, baseRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Alice Wins'), { target: { value: '2' } });
      });

      // The controlled Input still shows what the organiser typed — nothing rolled it back
      // to the last value the server actually has.
      expect(screen.getByLabelText('Alice Wins')).toHaveValue(2);
    });

    it('lands both edits when the same match is edited twice before the first request resolves', async () => {
      const csrfFetch = jest.fn(
        async (_url?: RequestInfo, _init?: RequestInit) =>
          ({ ok: true, json: async () => ({ success: 'true' }) }) as unknown as Response,
      );
      renderPage(true, baseRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      // Two fields of the same match change back-to-back, before either request's response
      // has a chance to land — a pairing correction right after entering a score.
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Alice Wins'), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText('Player 2'), { target: { value: 'Unknown Opponent' } });
      });

      expect(csrfFetch).toHaveBeenCalledTimes(2);
      // The second payload is built from the already-applied first edit, not the stale prop
      // from before either change — so it carries both, rather than reverting the first.
      const [, secondInit] = csrfFetch.mock.calls[1];
      expect(JSON.parse(secondInit!.body as string)).toEqual({
        roundIndex: 0,
        matchIndex: 0,
        match: { p1: 'Alice', p2: 'Unknown Opponent', results: [2, 0, 0] },
      });
    });

    it('clears the not-saved indication once a later commit for the same match succeeds', async () => {
      const csrfFetch = jest
        .fn()
        .mockImplementationOnce(async () => {
          throw new Error('network down');
        })
        .mockImplementationOnce(
          async () => ({ ok: true, json: async () => ({ success: 'true' }) }) as unknown as Response,
        );
      renderPage(true, baseRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Alice Wins'), { target: { value: '2' } });
      });
      expect(screen.getByRole('alert')).toBeInTheDocument();

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Alice Wins'), { target: { value: '3' } });
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // failedMatches is keyed "roundIndex:matchIndex" — purely positional, since Match carries
    // no stable id. Removing an earlier match in the same round reindexes every later match
    // down one slot server-side, so the indicator must follow the match that actually failed
    // rather than staying pinned to the index it used to occupy.
    it('keeps the not-saved indicator on the match that failed when an earlier match is removed', async () => {
      const csrfFetch = jest.fn(async (url: RequestInfo, _init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/set/')) {
          return { ok: false, json: async () => ({ success: 'false' }) } as unknown as Response;
        }
        // The remove reindexes the round server-side: Alice/Bob (index 0) is gone, so
        // Carol/Dave and Eve/Frank each shift down one index.
        return {
          ok: true,
          json: async () => ({
            success: 'true',
            round: {
              matches: [
                { p1: 'Carol', p2: 'Dave', results: [0, 1, 0] },
                { p1: 'Eve', p2: 'Frank', results: [0, 0, 0] },
              ],
            },
          }),
        } as unknown as Response;
      });
      renderPage(true, threeMatchRoundRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      // Fail a commit on the later match (Eve/Frank, index 2) first.
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Eve Wins'), { target: { value: '2' } });
      });
      expect(within(matchRowFor('Eve Wins')).getByRole('alert')).toBeInTheDocument();

      // Then remove an earlier, unrelated, already-saved match (Alice/Bob, index 0).
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove match 1' }));
      });

      // The indicator must still be on Eve/Frank's row — now at index 1 — not on Carol/Dave,
      // which shifted into Eve/Frank's old index but never failed.
      expect(within(matchRowFor('Eve Wins')).getByRole('alert')).toBeInTheDocument();
      expect(within(matchRowFor('Carol Wins')).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('drops the not-saved indicator when the failed match itself is removed', async () => {
      const csrfFetch = jest.fn(async (url: RequestInfo, _init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/set/')) {
          return { ok: false, json: async () => ({ success: 'false' }) } as unknown as Response;
        }
        // Carol/Dave (the failed match, index 1) is removed server-side; Eve/Frank shifts
        // down into index 1.
        return {
          ok: true,
          json: async () => ({
            success: 'true',
            round: {
              matches: [
                { p1: 'Alice', p2: 'Bob', results: [1, 0, 0] },
                { p1: 'Eve', p2: 'Frank', results: [0, 0, 0] },
              ],
            },
          }),
        } as unknown as Response;
      });
      renderPage(true, threeMatchRoundRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      // Fail a commit on Carol/Dave (index 1).
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Carol Wins'), { target: { value: '2' } });
      });
      expect(within(matchRowFor('Carol Wins')).getByRole('alert')).toBeInTheDocument();

      // Remove that same match.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove match 2' }));
      });

      // Eve/Frank now occupies the removed match's old index, but never failed, and must not
      // inherit its indicator. Nor should Alice/Bob, which never moved.
      expect(within(matchRowFor('Eve Wins')).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(matchRowFor('Alice Wins')).queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('leaves a failure in one round alone when a match is removed from a different round', async () => {
      const csrfFetch = jest.fn(async (url: RequestInfo, _init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/set/')) {
          return { ok: false, json: async () => ({ success: 'false' }) } as unknown as Response;
        }
        // Round 2's Carol/Dave (index 0) is removed; Eve/Frank shifts down into index 0.
        return {
          ok: true,
          json: async () => ({
            success: 'true',
            round: { matches: [{ p1: 'Eve', p2: 'Frank', results: [0, 0, 0] }] },
          }),
        } as unknown as Response;
      });
      renderPage(true, twoRoundMultiMatchRecord, draft, csrfFetch);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
      // Round 2 (the latest) opens expanded by default; Round 1 needs expanding too.
      fireEvent.click(screen.getByRole('button', { name: 'Expand Round 1' }));

      // Fail a commit in round 1 (Alice/Bob, roundIndex 0, matchIndex 0).
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Alice Wins'), { target: { value: '2' } });
      });
      expect(within(matchRowFor('Alice Wins')).getByRole('alert')).toBeInTheDocument();

      // Remove a match from round 2 (roundIndex 1) — an entirely different round.
      await act(async () => {
        fireEvent.click(screen.getAllByRole('button', { name: 'Remove match 1' })[1]);
      });

      // Round 1's pending failure must be untouched by a removal that happened in round 2.
      expect(within(matchRowFor('Alice Wins')).getByRole('alert')).toBeInTheDocument();
    });

    it('shows a non-owner the rounds with no controls at all', () => {
      renderPage(false, baseRecord);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      expect(screen.getByTitle('Alice Wins')).toHaveTextContent('1');
      expect(screen.getByTitle('Bob Wins')).toHaveTextContent('0');
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(screen.queryByText('Remove Round')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add Match' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Remove match/ })).not.toBeInTheDocument();
    });

    it('opens a round on a record with no players without unusable rows', () => {
      renderPage(true, noPlayersWithRoundRecord);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));

      expect(screen.getAllByLabelText('Player 1')[0]).toHaveValue('Unknown Opponent');
      expect(screen.getAllByLabelText('Player 2')[0]).toHaveValue('Unknown Opponent');
    });
  });
});
