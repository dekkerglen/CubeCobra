import React from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';

import { CSRFContext } from 'contexts/CSRFContext';

import { createCardDetails } from '../../../server/test/test-utils/data';
import RecordTranscribePage from '../../src/pages/RecordTranscribePage';

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
jest.mock('components/TextEntry', () => ({ __esModule: true, default: () => <div data-testid="text-entry" /> }));

const SAVE_URL = '/cube/records/enter/rec-1';
const NAME_INPUT = 'Enter a name for the record';

const cube = { id: 'cube-1', name: 'My Cube' } as unknown as Cube;

const createRecord = (overrides: Partial<Record> = {}): Record => ({
  id: 'rec-1',
  cube: 'cube-1',
  date: 1700000000000,
  name: 'Tuesday Night',
  description: 'Eight players, three rounds',
  players: [{ name: 'Alice' }, { name: 'Bob' }],
  matches: [],
  trophy: [],
  ...overrides,
});

const draftCard = (name: string) => ({
  cardID: name,
  details: createCardDetails({ name, oracle_id: `oracle-${name}` }),
});

// A record created from a real played draft: its seat pools are tied to the draft's pick
// orders, so the page may not offer to edit them.
const playedDraft = (): Draft =>
  ({
    id: 'draft-1',
    cube: 'cube-1',
    type: DRAFT_TYPES.DRAFT,
    cards: [draftCard('Lightning Bolt'), draftCard('Pyroblast'), draftCard('Counterspell')],
    seats: [
      { mainboard: [[[0]]], sideboard: [[[1]]] },
      { mainboard: [[[2]]], sideboard: [[[]]] },
    ],
  }) as unknown as Draft;

// Answers the cube-pool lookup UploadDeck makes on mount, resolves pasted card names, and
// records the save POST.
const makeCsrfFetch = (saveResponse: any = { success: 'true' }) =>
  jest.fn(async (url: RequestInfo, init?: RequestInit) => {
    if (typeof url === 'string' && url.startsWith('/cube/api/cubecardpool/')) {
      return { ok: true, json: async () => ({ success: 'true', basics: [] }) } as Response;
    }
    if (url === '/cube/api/getcardsforcube') {
      const { names } = JSON.parse(`${init?.body}`) as { names: string[] };
      return {
        ok: true,
        json: async () => ({
          success: 'true',
          cards: names.map((name) => createCardDetails({ name, oracle_id: `oracle-${name}` })),
        }),
      } as Response;
    }
    if (url === SAVE_URL) {
      return { ok: true, json: async () => saveResponse } as Response;
    }
    return { ok: false, status: 404, json: async () => ({ success: 'false' }) } as Response;
  });

const renderPage = ({
  record = createRecord(),
  draft,
  csrfFetch = makeCsrfFetch(),
}: { record?: Record; draft?: Draft; csrfFetch?: jest.Mock } = {}) => {
  const result = render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <RecordTranscribePage cube={cube} record={record} draft={draft} players={[]} />
    </CSRFContext.Provider>,
  );

  return { ...result, csrfFetch };
};

const saveCalls = (csrfFetch: jest.Mock) => csrfFetch.mock.calls.filter(([url]) => url === SAVE_URL);

const savedPayload = (csrfFetch: jest.Mock) => JSON.parse(`${saveCalls(csrfFetch)[0][1].body}`);

const saveButton = () => screen.getByRole('button', { name: 'Save' });

describe('RecordTranscribePage', () => {
  it('renders a deck section per player with the paste box ready', () => {
    renderPage();

    const rows = screen.getAllByTestId('transcribe-deck-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('button', { name: /Alice/ })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('button', { name: /Bob/ })).toBeInTheDocument();

    // Only the row being worked on mounts an editor, and Task 2 leaves its paste box open.
    expect(screen.getAllByPlaceholderText(/Paste your decklist here/)).toHaveLength(1);
    expect(within(rows[0]).getByPlaceholderText(/Paste your decklist here/)).toBeInTheDocument();
  });

  it('renders existing decks read-only when the draft is not an upload draft', () => {
    renderPage({ draft: playedDraft() });

    const rows = screen.getAllByTestId('transcribe-deck-row');
    expect(within(rows[0]).getByText('Lightning Bolt')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Pyroblast')).toBeInTheDocument();

    expect(screen.queryByPlaceholderText(/Paste your decklist here/)).not.toBeInTheDocument();
    expect(within(rows[0]).getByText(/attached to a played draft/)).toBeInTheDocument();
  });

  // The endpoint refuses a save that adds, removes or reorders players on a played draft, so
  // the page must not put those controls in front of the user at all.
  it('offers no way to add, remove or reorder players on a played draft', () => {
    const { unmount } = renderPage();
    expect(screen.getByRole('button', { name: 'Edit players' })).toBeInTheDocument();
    unmount();

    renderPage({ draft: playedDraft() });

    expect(screen.queryByRole('button', { name: 'Edit players' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Player' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Last Player' })).not.toBeInTheDocument();
  });

  // A played draft's seats are written by the draft, not by this page. A dirty flag on one of
  // them makes the endpoint reject the whole save, overview and pairings included.
  it('submits no deck edits for a played draft, even alongside other changes', async () => {
    const { csrfFetch } = renderPage({ draft: playedDraft() });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
    expect(savedPayload(csrfFetch)).toMatchObject({ name: 'Renamed Night', seatOrder: [0, 1], decks: {} });
  });

  // The endpoint drops every key that is not a submitted player name, so a rename that stopped
  // at the player list would silently throw away that player's pairings, trophy and standing.
  it('re-keys pairings, trophies and overrides when a player is renamed', async () => {
    const record = createRecord({
      matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] as [number, number, number] }] }],
      trophy: ['Alice'],
      overrides: { Alice: { wins: 3, losses: 0, draws: 0 } },
    });
    const { csrfFetch } = renderPage({ record });

    fireEvent.click(screen.getByRole('button', { name: 'Rename Alice' }));
    fireEvent.change(screen.getByPlaceholderText(/Player name/), { target: { value: 'Alicia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Rename Alicia' })).toBeInTheDocument());

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    const payload = savedPayload(csrfFetch);
    expect(payload.players).toEqual([{ name: 'Alicia' }, { name: 'Bob' }]);
    expect(payload.matches[0].matches[0].p1).toBe('Alicia');
    expect(payload.trophy).toEqual(['Alicia']);
    expect(payload.overrides).toEqual({ Alicia: { wins: 3, losses: 0, draws: 0 } });
    // The seat still holds whoever sat there, so the draft is not reshuffled by a rename.
    expect(payload.seatOrder).toEqual([0, 1]);
  });

  it('submits a pasted decklist under the seat it was entered against', async () => {
    const { csrfFetch } = renderPage();

    fireEvent.change(screen.getByPlaceholderText(/Paste your decklist here/), {
      target: { value: '2x Lightning Bolt\nSideboard\nPyroblast' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Parse and Add to Mainboard/ }));

    await waitFor(() => expect(screen.getByText('Unsaved changes')).toBeInTheDocument());

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // Keyed 1-based: seat 1 is Alice, whose row the paste went into. Bob's untouched seat is
    // left out entirely rather than re-written as an empty deck.
    expect(savedPayload(csrfFetch).decks).toEqual({
      '1': {
        mainboard: ['oracle-Lightning Bolt', 'oracle-Lightning Bolt'],
        sideboard: ['oracle-Pyroblast'],
      },
    });
  });

  it('switches the results section between Pairings and Final records only', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Add Round' })).toBeInTheDocument();
    expect(screen.queryAllByLabelText('Wins')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    expect(screen.queryByRole('button', { name: 'Add Round' })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Wins')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Pairings' }));

    expect(screen.getByRole('button', { name: 'Add Round' })).toBeInTheDocument();
    expect(screen.queryAllByLabelText('Wins')).toHaveLength(0);
  });

  it('warns that an override takes precedence when both an override and pairings exist', () => {
    const matches = [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] as [number, number, number] }] }];

    const { unmount } = renderPage({ record: createRecord({ matches }) });
    expect(screen.queryByText(/takes precedence/)).not.toBeInTheDocument();
    unmount();

    renderPage({ record: createRecord({ matches, overrides: { Alice: { wins: 3, losses: 0, draws: 0 } } }) });

    expect(screen.getByText(/takes precedence/)).toBeInTheDocument();
  });

  it('POSTs the payload to /cube/records/enter/:id once on Save', async () => {
    const { csrfFetch } = renderPage();

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    const [, init] = saveCalls(csrfFetch)[0];
    expect(init.method).toBe('POST');
    expect(savedPayload(csrfFetch)).toMatchObject({
      name: 'Renamed Night',
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      seatOrder: [0, 1],
      // Nothing was typed into a deck, so no seat is rewritten.
      decks: {},
    });

    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());
  });

  it('keeps the entered state and shows the message when the save responds success:false', async () => {
    const csrfFetch = makeCsrfFetch({ success: 'false', message: 'Seat order must have exactly one entry per player' });
    renderPage({ csrfFetch });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(screen.getByText('Seat order must have exactly one entry per player')).toBeInTheDocument(),
    );

    expect(screen.getByPlaceholderText(NAME_INPUT)).toHaveValue('Renamed Night');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('disables Save and reports no unsaved changes on a freshly loaded record', () => {
    renderPage();

    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  // The server's Joi schema caps the player list at 16, so the page has to stop the user
  // before Save rather than surfacing a raw rejection after it.
  it('blocks Save on a player list longer than the server accepts', () => {
    const players = Array.from({ length: 17 }, (_, index) => ({ name: `Player ${index + 1}` }));
    renderPage({ record: createRecord({ players }) });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });

    expect(screen.getByText(/at most 16 players/)).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });
});
