import React from 'react';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';
import Draft, { DRAFT_TYPES } from '@utils/datatypes/Draft';
import Record from '@utils/datatypes/Record';

import { SortableList } from 'components/DND';
import { CSRFContext } from 'contexts/CSRFContext';

import { createCardDetails } from '../../../server/test/test-utils/data';
import RecordTranscribePage from '../../src/pages/RecordTranscribePage';

// Keeps the real sortable components — the rows are wrapped in the same dnd-kit context they
// are in a browser — while making two otherwise invisible things assertable:
//
// SortableList is spied on so the drop can be driven through the handler and the ids it was
// actually given. dnd-kit's own sensors need pointer geometry jsdom does not produce (an 8px
// MouseSensor distance, a 200ms TouchSensor delay), so a drag cannot be simulated here.
//
// SortableItem's handleProps carry a marker. The listeners inside them are React props and
// leave no trace in the DOM; the marker is spread from the same object, so the element that
// carries it is exactly the element dnd-kit's drag listeners landed on, and nothing else is.
jest.mock('components/DND', () => {
  const actual = jest.requireActual('components/DND');
  return {
    __esModule: true,
    ...actual,
    SortableList: jest.fn(actual.SortableList),
    SortableItem: ({ children, ...props }: any) => (
      <actual.SortableItem {...props}>
        {({ handleProps }: any) => children({ handleProps: { ...handleProps, 'data-drag-listeners': 'true' } })}
      </actual.SortableItem>
    ),
  };
});

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
const ADD_PLAYER_INPUT = /Add a player/;

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

// Answers the cube-pool lookup UploadDeck makes on mount, the @handle lookup behind adding
// and renaming a player, resolves pasted card names, and records the save POST. Names listed
// in `unresolved` come back null, the way the real endpoint reports a name it could not find.
const makeCsrfFetch = (saveResponse: any = { success: 'true' }, unresolved: string[] = []) =>
  jest.fn(async (url: RequestInfo, init?: RequestInit) => {
    if (typeof url === 'string' && url.startsWith('/cube/api/cubecardpool/')) {
      return { ok: true, json: async () => ({ success: 'true', basics: [] }) } as Response;
    }
    if (typeof url === 'string' && url.startsWith('/api/user/getByUsername/')) {
      // The real endpoint answers with the account's own casing, which is how a linked
      // player ends up displayed as the site spells them rather than as they were typed.
      const handle = decodeURIComponent(url.slice('/api/user/getByUsername/'.length));
      return {
        ok: true,
        json: async () => ({
          user: { id: `user-${handle}`, username: `${handle[0].toUpperCase()}${handle.slice(1)}` },
        }),
      } as Response;
    }
    if (url === '/cube/api/getcardsforcube') {
      const { names } = JSON.parse(`${init?.body}`) as { names: string[] };
      return {
        ok: true,
        json: async () => ({
          success: 'true',
          cards: names.map((name) =>
            unresolved.some((missing) => missing.toLowerCase() === name.toLowerCase())
              ? null
              : createCardDetails({ name, oracle_id: `oracle-${name}` }),
          ),
        }),
      } as Response;
    }
    if (url === SAVE_URL) {
      return { ok: true, json: async () => saveResponse } as Response;
    }
    return { ok: false, status: 404, json: async () => ({ success: 'false' }) } as Response;
  });

// Holds the save request open so the page can be inspected while it is in flight. Every
// other request is answered as usual.
const makeDeferredCsrfFetch = (saveResponse: any = { success: 'true' }) => {
  const base = makeCsrfFetch(saveResponse);
  let release: () => void = () => {};
  const inFlight = new Promise<void>((resolve) => {
    release = resolve;
  });

  const csrfFetch = jest.fn(async (url: RequestInfo, init?: RequestInit) => {
    if (url === SAVE_URL) {
      await inFlight;
    }
    return base(url, init);
  });

  return { csrfFetch, release: () => act(async () => release()) };
};

// Holds the save POST and the @handle lookup open independently, so an edit that is waiting
// on a lookup can be made to land after something else has already happened — a save opening
// underneath it, or the player it renames being removed. Both are refused at entry when they
// are started during a save, so the only way to reach the post-await path is to start the
// lookup first and move the world while it is outstanding.
const makeInterleavableCsrfFetch = (saveResponse: any = { success: 'true' }) => {
  const base = makeCsrfFetch(saveResponse);

  const gate = () => {
    let open: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      open = resolve;
    });
    return { held, release: () => act(async () => open()) };
  };

  const save = gate();
  const lookup = gate();

  const csrfFetch = jest.fn(async (url: RequestInfo, init?: RequestInit) => {
    if (url === SAVE_URL) {
      await save.held;
    }
    if (typeof url === 'string' && url.startsWith('/api/user/getByUsername/')) {
      await lookup.held;
    }
    return base(url, init);
  });

  return { csrfFetch, releaseSave: save.release, releaseLookup: lookup.release };
};

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

// One collapsible row per player. The expand toggle is the row's first button, which stays
// addressable when two rows read the same name — exactly the case the duplicate tests make.
const playerRows = () => screen.getAllByTestId('transcribe-player-row');

const playerRow = (index: number) => playerRows()[index];

const expandToggle = (index: number) => within(playerRow(index)).getAllByRole('button')[0];

const toggleRow = (index: number) => fireEvent.click(expandToggle(index));

// The three record cells live on the collapsed row, so they are addressed through it rather
// than through the one open body the other row helpers assume.
const recordCell = (index: number, field: 'Wins' | 'Losses' | 'Draws') =>
  within(playerRow(index)).getByLabelText(new RegExp(`^${field} for `)) as HTMLInputElement;

const hasRecordCells = (index: number) => within(playerRow(index)).queryByLabelText(/^Wins for /) !== null;

// jsdom does not implement Tab and @testing-library/user-event is not a dependency here.
// Native tabbing visits focusable elements in document order, so this is the sequence Tab
// walks.
const tabOrder = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  ).filter((element) => !element.hasAttribute('disabled'));

// Only one row is expanded at a time, so each of these addresses the open row's body.
const nameField = () => screen.getByLabelText('Player name') as HTMLInputElement;

const trophyToggle = () => screen.getByRole('checkbox', { name: 'Trophy' });

const pasteBox = (index: number) =>
  within(playerRow(index)).getByPlaceholderText(/Paste your decklist here/) as HTMLTextAreaElement;

const renameOpenRow = async (value: string, commit: 'blur' | 'enter' = 'blur') => {
  fireEvent.change(nameField(), { target: { value } });
  if (commit === 'enter') {
    fireEvent.keyDown(nameField(), { key: 'Enter', code: 'Enter' });
  } else {
    fireEvent.blur(nameField());
  }
  // The commit resolves a possible @handle before it lands, so it is always a tick away.
  await act(async () => {});
};

// Reverses the player list through the section header's Shuffle. EditPlayerList's idiom,
// `sort(() => Math.random() - 0.5)`, reverses a list deterministically once Math.random is
// pinned below 0.5; the assertion afterwards fails loudly if it ever stops.
const reversePlayerList = () => {
  const random = jest.spyOn(Math, 'random').mockReturnValue(0);
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle Players' }));
  } finally {
    random.mockRestore();
  }

  expect(playerRow(0)).toHaveTextContent('Bob');
  expect(playerRow(1)).toHaveTextContent('Alice');
};

// Drops the player at `from` onto the row at `to`, through the handler and the ids dnd-kit
// itself would call with on a real drop. Reading the ids back off the props rather than
// spelling them out keeps the drop addressed by position, whatever the rows are keyed by.
const dragPlayer = (from: number, to: number) => {
  const { items, onDragEnd } = (SortableList as unknown as jest.Mock).mock.calls.at(-1)![0];
  act(() => {
    onDragEnd({ active: { id: items[from] }, over: { id: items[to] } });
  });
};

// The element the drag listeners were spread onto, within one row.
const dragSurfaces = (index: number) => playerRow(index).querySelectorAll('[data-drag-listeners]');

describe('RecordTranscribePage', () => {
  beforeEach(() => {
    (SortableList as unknown as jest.Mock).mockClear();
  });

  it('renders one row per player and no separate decks section', () => {
    renderPage();

    const rows = playerRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Alice');
    expect(rows[1]).toHaveTextContent('Bob');
    expect(screen.getByText('2 players')).toBeInTheDocument();

    // The decks used to be a second list of the same people under their own heading.
    expect(screen.queryByText('Decks')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('transcribe-deck-row')).toHaveLength(0);
  });

  it('shows the deck summary and the unsaved marker on the collapsed row', async () => {
    renderPage();

    expect(playerRow(1)).toHaveTextContent('No deck yet');
    expect(playerRow(1)).not.toHaveTextContent('unsaved');

    fireEvent.change(pasteBox(0), { target: { value: '2x Lightning Bolt\nSideboard\nPyroblast' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse and Add to Mainboard/ }));

    await waitFor(() => expect(playerRow(0)).toHaveTextContent('2 cards + 1 sideboard • unsaved'));
    // The marker is the deck's, so it does not spread to a player whose deck is untouched.
    expect(playerRow(1)).not.toHaveTextContent('unsaved');
  });

  it('keeps the deck editor mounted for only the expanded row', () => {
    renderPage();

    // A pod of eight would otherwise fetch the cube's pool eight times over on mount.
    expect(screen.getAllByPlaceholderText(/Paste your decklist here/)).toHaveLength(1);
    expect(within(playerRow(0)).getByPlaceholderText(/Paste your decklist here/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Player name')).toHaveLength(1);

    toggleRow(1);

    expect(screen.getAllByPlaceholderText(/Paste your decklist here/)).toHaveLength(1);
    expect(within(playerRow(1)).getByPlaceholderText(/Paste your decklist here/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Player name')).toHaveLength(1);
  });

  it('adds a player from the section header', async () => {
    const { csrfFetch } = renderPage();

    fireEvent.change(screen.getByPlaceholderText(ADD_PLAYER_INPUT), { target: { value: 'Carol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));

    await waitFor(() => expect(playerRows()).toHaveLength(3));
    expect(playerRow(2)).toHaveTextContent('Carol');
    expect(screen.getByText('3 players')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(ADD_PLAYER_INPUT)).toHaveValue('');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // -1 is how the server is told this seat is new rather than moved.
    expect(savedPayload(csrfFetch)).toMatchObject({
      players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }],
      seatOrder: [0, 1, -1],
    });
  });

  it('resolves an @handle when adding a player', async () => {
    const { csrfFetch } = renderPage();

    fireEvent.change(screen.getByPlaceholderText(ADD_PLAYER_INPUT), { target: { value: '@carol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));

    await waitFor(() => expect(playerRows()).toHaveLength(3));
    // The account's own spelling, not the handle as typed.
    expect(playerRow(2)).toHaveTextContent('Carol');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedPayload(csrfFetch).players[2]).toEqual({ name: 'Carol', userId: 'user-carol' });
  });

  it('removes a player from their row body', async () => {
    const { csrfFetch } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice' }));

    expect(playerRows()).toHaveLength(1);
    expect(playerRow(0)).toHaveTextContent('Bob');
    expect(screen.getByText('1 player')).toBeInTheDocument();

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // Bob keeps pointing at the draft seat he actually sat in.
    expect(savedPayload(csrfFetch)).toMatchObject({ players: [{ name: 'Bob' }], seatOrder: [1] });
  });

  it('closes the expansion when the expanded player is removed', () => {
    renderPage();

    expect(nameField()).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice' }));

    // The body that held the remove control belonged to a player who is gone; leaving the
    // expansion on that index would open it onto whoever moved up into the seat.
    expect(screen.queryByLabelText('Player name')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Paste your decklist here/)).not.toBeInTheDocument();
    expect(playerRows()).toHaveLength(1);
  });

  it('shuffles from the section header', async () => {
    const { csrfFetch } = renderPage();

    reversePlayerList();

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedPayload(csrfFetch)).toMatchObject({
      players: [{ name: 'Bob' }, { name: 'Alice' }],
      seatOrder: [1, 0],
    });
  });

  // Shuffle randomizes; it cannot put one person in the seat they actually sat in. The handle
  // is on the collapsed row only, so a drag can never begin inside the open body's text fields.
  it('renders a drag handle on each collapsed row', () => {
    renderPage();

    expect(within(playerRow(0)).getByLabelText('Drag Alice to reorder')).toBeInTheDocument();
    expect(within(playerRow(1)).getByLabelText('Drag Bob to reorder')).toBeInTheDocument();
  });

  it('reorders players on drag end, carrying each deck with its player', async () => {
    renderPage();

    fireEvent.change(pasteBox(0), { target: { value: '2x Lightning Bolt\nSideboard\nPyroblast' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse and Add to Mainboard/ }));
    await waitFor(() => expect(playerRow(0)).toHaveTextContent('2 cards + 1 sideboard'));

    dragPlayer(0, 1);

    expect(playerRow(0)).toHaveTextContent('Bob');
    expect(playerRow(0)).toHaveTextContent('No deck yet');
    // The deck is keyed by position, so it only stays with Alice if the move re-keys it.
    expect(playerRow(1)).toHaveTextContent('Alice');
    expect(playerRow(1)).toHaveTextContent('2 cards + 1 sideboard');
  });

  it('submits a seatOrder matching the new order after a reorder', async () => {
    const { csrfFetch } = renderPage();

    dragPlayer(1, 0);

    expect(playerRow(0)).toHaveTextContent('Bob');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // Each player still points at the draft seat they came from, which is what carries their
    // deck across on the server.
    expect(savedPayload(csrfFetch)).toMatchObject({
      players: [{ name: 'Bob' }, { name: 'Alice' }],
      seatOrder: [1, 0],
    });
  });

  // The endpoint refuses a reorder on a played draft for the same reason it refuses an add or
  // a remove, so the handle must not be offered there at all.
  it('renders no drag handle when seats are not editable', () => {
    const { unmount } = renderPage();
    expect(screen.getAllByLabelText(/ to reorder$/)).toHaveLength(2);
    unmount();

    renderPage({ draft: playedDraft() });

    expect(screen.queryAllByLabelText(/ to reorder$/)).toHaveLength(0);
    expect(screen.queryAllByTestId('transcribe-player-row')).toHaveLength(2);
  });

  // The page re-bases seatOrder to identity when a save lands, which is only sound if no new
  // permutation can be created while the request is open. A drop is one more way to make one.
  it('ignores a drag end while a save is in flight', async () => {
    const { csrfFetch, release } = makeDeferredCsrfFetch();
    renderPage({ csrfFetch });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    dragPlayer(0, 1);

    expect(playerRow(0)).toHaveTextContent('Alice');
    expect(playerRow(1)).toHaveTextContent('Bob');

    await release();
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());

    // ...and the same drop goes through once the save has landed.
    dragPlayer(0, 1);

    expect(playerRow(0)).toHaveTextContent('Bob');
    expect(playerRow(1)).toHaveTextContent('Alice');
  });

  // The expansion is a position, and a reorder moves players under it. Leaving it where it
  // was would hand one player's half-typed name and paste to whoever landed in their place.
  it('keeps the expansion on the same player after a reorder', () => {
    renderPage();

    // Alice's row opens on load as the first player still missing a deck.
    expect(within(playerRow(0)).getByLabelText('Player name')).toHaveValue('Alice');
    fireEvent.change(pasteBox(0), { target: { value: "Alice's deck" } });

    dragPlayer(0, 1);

    expect(screen.getAllByLabelText('Player name')).toHaveLength(1);
    expect(within(playerRow(1)).getByLabelText('Player name')).toHaveValue('Alice');
    expect(pasteBox(1)).toHaveValue("Alice's deck");
  });

  // The row body holds the name input and the paste box. Were the row itself the drag target,
  // a drag begun in either would start a sort instead of selecting text.
  it('does not put drag listeners on the name input', () => {
    renderPage();

    const row = playerRow(0);
    expect(dragSurfaces(0)).toHaveLength(1);

    const handle = dragSurfaces(0)[0];
    expect(handle).toBe(within(row).getByLabelText('Drag Alice to reorder'));
    expect(handle.contains(within(row).getByLabelText('Player name'))).toBe(false);
    expect(handle.contains(pasteBox(0))).toBe(false);
    // Neither the row nor the wrapper dnd-kit positions is a drag surface in its own right.
    expect(row).not.toHaveAttribute('data-drag-listeners');
    expect(row.parentElement).not.toHaveAttribute('data-drag-listeners');
  });

  it('renames a player from their row body, committing on blur', async () => {
    const { csrfFetch } = renderPage();

    await renameOpenRow('Alicia');

    expect(playerRow(0)).toHaveTextContent('Alicia');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedPayload(csrfFetch).players).toEqual([{ name: 'Alicia' }, { name: 'Bob' }]);
  });

  it('renames a player committing on Enter', async () => {
    const { csrfFetch } = renderPage();

    await renameOpenRow('Alicia', 'enter');

    expect(playerRow(0)).toHaveTextContent('Alicia');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedPayload(csrfFetch).players).toEqual([{ name: 'Alicia' }, { name: 'Bob' }]);
  });

  // A rename onto another player's name is refused at the field rather than applied.
  // Applying it was destructive in a way no page-level error could undo: applyPlayerEdit
  // runs applyPlayerRenames, which rewrites every key derived from a player's name, so the
  // collision folds both players' pairings, trophies and overrides onto one name — and the
  // user's immediate correction renames the merged result back, leaving no duplicate left
  // to report and Save enabled over a destroyed record.
  it("refuses a rename onto another player's name, keeping the typed text on the row", async () => {
    renderPage();

    await renameOpenRow('Bob');

    expect(screen.getByText('Another player is already named Bob')).toBeInTheDocument();
    // Nothing is thrown away: the refusal leaves the entry where it is to be corrected.
    expect(nameField()).toHaveValue('Bob');
    // ...and the list is untouched, so there is no second Bob and nothing page-wide to say.
    expect(playerRow(0)).toHaveTextContent('Alice');
    expect(playerRow(1)).toHaveTextContent('Bob');
    expect(screen.queryByText(/Two players cannot share a name/)).not.toBeInTheDocument();
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();
  });

  it('refuses a rename that collides only in case', async () => {
    renderPage();

    await renameOpenRow('bob');

    expect(screen.getByText('Another player is already named bob')).toBeInTheDocument();
    expect(playerRow(0)).toHaveTextContent('Alice');
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();
  });

  // The whole of the bug: a typo and its correction, one field at a time, which is the only
  // way to swap two names now the batch editor is gone. The payload after the typo must be
  // indistinguishable from the payload of a run that never made it.
  it('leaves pairings, overrides and trophies untouched by a rename collision and its correction', async () => {
    const record = () =>
      createRecord({
        matches: pairedRound(),
        trophy: ['Alice'],
        overrides: { Alice: { wins: 3, losses: 0, draws: 0 }, Bob: { wins: 1, losses: 2, draws: 0 } },
      });

    const clean = renderPage({ record: record() });
    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(clean.csrfFetch)).toHaveLength(1));
    const baseline = savedPayload(clean.csrfFetch);
    clean.unmount();

    const typo = renderPage({ record: record() });

    // The typo...
    await renameOpenRow('Bob');
    // ...and the correction a second later, which is what used to make the damage
    // unreportable: after it there is no duplicate for validationErrors to catch.
    await renameOpenRow('Alice');

    expect(playerRows()).toHaveLength(2);
    expect(playerRow(0)).toHaveTextContent('Alice');
    expect(playerRow(1)).toHaveTextContent('Bob');
    expect(screen.queryByText(/Two players cannot share a name/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(typo.csrfFetch)).toHaveLength(1));
    const payload = savedPayload(typo.csrfFetch);

    // Spelled out as well as compared, so the failure names what was destroyed rather than
    // only that two payloads differ.
    expect(payload.players).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
    expect(payload.matches[0].matches[0]).toMatchObject({ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] });
    expect(payload.overrides).toEqual({
      Alice: { wins: 3, losses: 0, draws: 0 },
      Bob: { wins: 1, losses: 2, draws: 0 },
    });
    expect(payload.trophy).toEqual(['Alice']);
    expect(payload).toEqual(baseline);
  });

  // The other way a name can be taken twice. It is not destructive on its own, but it hands
  // both seats every name-keyed thing in the record and makes the rename that corrects it
  // rewrite both, so it is refused the same way.
  it('refuses an add under a name the list already holds', async () => {
    const { csrfFetch } = renderPage();

    fireEvent.change(screen.getByPlaceholderText(ADD_PLAYER_INPUT), { target: { value: 'bob' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));
    await act(async () => {});

    expect(playerRows()).toHaveLength(2);
    expect(screen.getByText('Another player is already named bob')).toBeInTheDocument();
    // The entry stays put so it can be corrected rather than retyped.
    expect(screen.getByPlaceholderText(ADD_PLAYER_INPUT)).toHaveValue('bob');
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();

    // Corrected, it lands, and the refusal stops being reported.
    fireEvent.change(screen.getByPlaceholderText(ADD_PLAYER_INPUT), { target: { value: 'Carol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));

    await waitFor(() => expect(playerRows()).toHaveLength(3));
    expect(screen.queryByText('Another player is already named bob')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(ADD_PLAYER_INPUT)).toHaveValue('');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
    expect(savedPayload(csrfFetch).players).toEqual([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }]);
  });

  // Refusing both ways in only closes the ways this page can create a collision. A record
  // that arrived already holding one still has to say so and still has to block Save, since
  // the endpoint rejects it.
  it('reports a seeded duplicate on the row and page-wide, and blocks Save', () => {
    renderPage({ record: createRecord({ players: [{ name: 'Alice' }, { name: 'alice' }] }) });

    expect(screen.getByText(/Two players cannot share a name: alice\./)).toBeInTheDocument();
    // The open row names it too, rather than leaving the page-level error to be hunted for.
    expect(screen.getByText('Another player is already named Alice')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('toggles a trophy from the row body', async () => {
    const { csrfFetch } = renderPage();

    expect(within(playerRow(0)).queryByRole('img', { name: 'Trophy' })).not.toBeInTheDocument();

    fireEvent.click(trophyToggle());

    expect(within(playerRow(0)).getByRole('img', { name: 'Trophy' })).toBeInTheDocument();
    expect(within(playerRow(1)).queryByRole('img', { name: 'Trophy' })).not.toBeInTheDocument();

    // ...and back off again, so the control is a toggle rather than a one-way award.
    fireEvent.click(trophyToggle());
    expect(within(playerRow(0)).queryByRole('img', { name: 'Trophy' })).not.toBeInTheDocument();

    fireEvent.click(trophyToggle());
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
    expect(savedPayload(csrfFetch).trophy).toEqual(['Alice']);
  });

  // The endpoint refuses a save that adds, removes or reorders players on a played draft, so
  // the page must not put those controls in front of the user at all.
  it('offers no add, remove or shuffle when seats are not editable', () => {
    const { unmount } = renderPage();
    expect(screen.getByRole('button', { name: 'Add Player' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shuffle Players' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Alice' })).toBeInTheDocument();
    unmount();

    renderPage({ draft: playedDraft() });

    expect(screen.queryByPlaceholderText(ADD_PLAYER_INPUT)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Player' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Shuffle Players' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Alice' })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be added, removed or reordered here/)).toBeInTheDocument();
  });

  // Renaming is the one player edit a played draft accepts, and it must not drag a deck edit
  // along with it: a dirty flag on a seat this record does not own is rejected wholesale.
  it('still offers rename when seats are not editable', async () => {
    const { csrfFetch } = renderPage({ draft: playedDraft() });

    await renameOpenRow('Alicia');

    expect(playerRow(0)).toHaveTextContent('Alicia');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedPayload(csrfFetch)).toMatchObject({
      players: [{ name: 'Alicia' }, { name: 'Bob' }],
      seatOrder: [0, 1],
      decks: {},
    });
  });

  // Whether this page owns the seats is a fact about the draft, not about the seeded decks:
  // a record with no players yet has no deck to read the flag off, and reading one would
  // leave it looking editable.
  it('offers no player editing on a played draft with no players yet', () => {
    renderPage({ record: createRecord({ players: [] }), draft: playedDraft() });

    expect(screen.queryAllByTestId('transcribe-player-row')).toHaveLength(0);
    expect(screen.getByText('0 players')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Player' })).not.toBeInTheDocument();
    expect(screen.getByText(/attached to a played draft/)).toBeInTheDocument();
  });

  it('shows the read-only deck and deckbuilder link for a played-draft seat', () => {
    renderPage({ draft: playedDraft() });

    expect(within(playerRow(0)).getByText('Lightning Bolt')).toBeInTheDocument();
    expect(within(playerRow(0)).getByText('Pyroblast')).toBeInTheDocument();

    expect(screen.queryByPlaceholderText(/Paste your decklist here/)).not.toBeInTheDocument();
    expect(within(playerRow(0)).getByText(/attached to a played draft/)).toBeInTheDocument();
    // Telling the user to edit the deck elsewhere is only useful alongside the way there.
    expect(within(playerRow(0)).getByRole('link', { name: /deckbuilder/ })).toHaveAttribute(
      'href',
      '/draft/deckbuilder/draft-1?seat=0',
    );
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

    await renameOpenRow('Alicia');

    expect(playerRow(0)).toHaveTextContent('Alicia');

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

  // Only one deck editor is mounted at a time, so the paste box is unmounted whenever another
  // player's row is opened. Holding its text inside the editor would throw a half-entered
  // decklist away.
  it('keeps a paste across a collapse and re-expand', () => {
    renderPage();

    fireEvent.change(pasteBox(0), { target: { value: '2x Lightning Bolt\nCounterspell' } });

    // Open Bob's row, which collapses Alice's and unmounts her editor.
    toggleRow(1);
    expect(screen.getAllByPlaceholderText(/Paste your decklist here/)).toHaveLength(1);
    expect(pasteBox(1)).toHaveValue('');

    toggleRow(0);

    expect(pasteBox(0)).toHaveValue('2x Lightning Bolt\nCounterspell');
  });

  // The lines that failed to resolve are left in the box next to their errors: that is the
  // designed way to fix up a partly-failed paste, and it has to survive looking elsewhere.
  it('keeps the retained lines and their errors from a partly-failed paste across a collapse', async () => {
    renderPage({ csrfFetch: makeCsrfFetch({ success: 'true' }, ['Notacard']) });

    fireEvent.change(pasteBox(0), { target: { value: 'Lightning Bolt\nNotacard' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse and Add to Mainboard/ }));

    await waitFor(() => expect(screen.getByText('Could not find card: "Notacard"')).toBeInTheDocument());
    expect(pasteBox(0)).toHaveValue('Notacard');

    toggleRow(1);
    expect(screen.queryByText('Could not find card: "Notacard"')).not.toBeInTheDocument();

    toggleRow(0);

    expect(pasteBox(0)).toHaveValue('Notacard');
    expect(screen.getByText('Could not find card: "Notacard"')).toBeInTheDocument();
  });

  // Each row owns its own paste, so working through one player's list does not put text in
  // front of the next player.
  it("keeps each player's paste to their own row", () => {
    renderPage();

    fireEvent.change(pasteBox(0), { target: { value: "Alice's deck" } });
    toggleRow(1);
    fireEvent.change(pasteBox(1), { target: { value: "Bob's deck" } });
    toggleRow(0);

    expect(pasteBox(0)).toHaveValue("Alice's deck");
    toggleRow(1);
    expect(pasteBox(1)).toHaveValue("Bob's deck");
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

  // The results mode names the kind of record being written down, so its toggle sits above
  // the whole page rather than inside the rounds editor it used to switch.
  const roundsShown = () => !!screen.queryByRole('button', { name: 'Add Round' });

  const pairedRound = () => [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] as [number, number, number] }] }];

  const aliceOverride = () => ({ Alice: { wins: 3, losses: 0, draws: 0 } });

  // The selected mode is otherwise distinguished by its border and background alone, and it
  // governs whether half the page renders.
  it('reports which results mode is selected to assistive tech', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    expect(screen.getByRole('button', { name: 'Pairings' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Final records only' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    expect(screen.getByRole('button', { name: 'Pairings' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Final records only' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders the rounds section in pairings mode', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    expect(screen.getByText('Rounds')).toBeInTheDocument();
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Round' })).toBeInTheDocument();
  });

  it('does not render the rounds section in final records mode', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    expect(screen.queryByText('Rounds')).not.toBeInTheDocument();
    expect(screen.queryByText('Round 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Round' })).not.toBeInTheDocument();
  });

  // Someone working from a standings sheet has final records and nothing else, so the page
  // must not open them on an empty pairings list.
  it('opens in final records mode for a record with overrides and no pairings', () => {
    renderPage({ record: createRecord({ overrides: aliceOverride() }) });

    expect(roundsShown()).toBe(false);

    // The mode is what is hiding them, not a page that cannot show rounds at all.
    fireEvent.click(screen.getByRole('button', { name: 'Pairings' }));
    expect(roundsShown()).toBe(true);
  });

  // Pairings win the seeding rule even alongside overrides: the record carries both, and the
  // pairings are the side that has an editor to come back to.
  it('opens in pairings mode for a record with pairings', () => {
    renderPage({ record: createRecord({ matches: pairedRound(), overrides: aliceOverride() }) });

    expect(roundsShown()).toBe(true);
  });

  it('opens in pairings mode for an empty record', () => {
    renderPage({ record: createRecord({ players: [], matches: [] }) });

    expect(roundsShown()).toBe(true);
  });

  // Final records mode hides the rounds editor, not the rounds. Without saying so, a record
  // transcribed pairing by pairing looks like it lost them.
  it('notes that pairings are recorded but hidden when final records mode hides rounds', () => {
    const { unmount } = renderPage({ record: createRecord({ matches: pairedRound() }) });

    expect(screen.queryByText(/pairings are hidden in this mode/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));
    expect(screen.getByText(/pairings are hidden in this mode/)).toBeInTheDocument();
    unmount();

    // Nothing to be hidden, nothing to say.
    renderPage({ record: createRecord({ matches: [] }) });
    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    expect(screen.queryByText(/pairings are hidden in this mode/)).not.toBeInTheDocument();
  });

  // The mode governs which editor is on screen and nothing else. Both sides of the record
  // stay in state and both are submitted, so a round trip through the other mode has to be
  // invisible in the payload.
  it('submits an unchanged payload after switching to final records and back', async () => {
    const record = () => createRecord({ matches: pairedRound(), overrides: aliceOverride() });

    const direct = renderPage({ record: record() });
    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(direct.csrfFetch)).toHaveLength(1));
    const baseline = savedPayload(direct.csrfFetch);
    direct.unmount();

    // The baseline has to carry data on both sides, or a mode switch that dropped one of
    // them would round-trip an empty payload to an empty payload and pass.
    expect(baseline.matches[0].matches[0]).toMatchObject({ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] });
    expect(baseline.overrides).toEqual(aliceOverride());

    const roundTripped = renderPage({ record: record() });
    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));
    expect(roundsShown()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Pairings' }));
    expect(roundsShown()).toBe(true);

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(roundTripped.csrfFetch)).toHaveLength(1));

    expect(savedPayload(roundTripped.csrfFetch)).toEqual(baseline);
  });

  it('puts the record cells on the collapsed row in final records mode', () => {
    renderPage();

    expect(hasRecordCells(1)).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    // Bob's row is shut, and his record is still typeable: making someone expand sixteen
    // rows in turn would regress the standings-sheet case this mode exists for.
    expect(within(playerRow(1)).queryByLabelText('Player name')).not.toBeInTheDocument();
    expect(recordCell(1, 'Wins')).toHaveValue(0);
    expect(recordCell(1, 'Losses')).toHaveValue(0);
    expect(recordCell(1, 'Draws')).toHaveValue(0);
  });

  // Three bare number boxes per row, times sixteen players, with no column heading. The
  // cells stay unlabelled to keep the row on one line, so the list says once what they are
  // and each cell names itself on hover.
  it('says what the record cells are, once above the list and on each cell', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    // Nothing is showing cells yet in pairings mode, so there is nothing to explain.
    expect(screen.queryByText(/Each record reads W \/ L \/ D/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "Edit Bob's record" }));
    expect(screen.getByText(/Each record reads W \/ L \/ D/)).toBeInTheDocument();
    expect(recordCell(1, 'Wins')).toHaveAttribute('title', 'Wins');
    expect(recordCell(1, 'Losses')).toHaveAttribute('title', 'Losses');
    expect(recordCell(1, 'Draws')).toHaveAttribute('title', 'Draws');

    // Every row carries cells in final records mode, so the legend is there from the start.
    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));
    expect(screen.getByText(/Each record reads W \/ L \/ D/)).toBeInTheDocument();
    expect(recordCell(0, 'Wins')).toHaveAttribute('title', 'Wins');
  });

  it('shows a read-only derived record in pairings mode', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    // Alice took the one match 2-1, so the row reads what the pairings add up to.
    expect(playerRow(0)).toHaveTextContent('1-0');
    expect(playerRow(1)).toHaveTextContent('0-1');
    expect(hasRecordCells(0)).toBe(false);
    expect(hasRecordCells(1)).toBe(false);
  });

  it('reveals the cells from the edit control in pairings mode', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    fireEvent.click(screen.getByRole('button', { name: "Edit Bob's record" }));

    // Seeded from the pairings rather than from zero, so the cells start at the reading they
    // replaced.
    expect(recordCell(1, 'Wins')).toHaveValue(0);
    expect(recordCell(1, 'Losses')).toHaveValue(1);
    // One row at a time: revealing Bob's cells leaves Alice reading her pairings.
    expect(hasRecordCells(0)).toBe(false);
    expect(playerRow(0)).toHaveTextContent('1-0');
  });

  // playerRecord prefers any present override, so a 0-0-0 written the moment the cells
  // appeared would silently replace what a player's pairings add up to.
  it('writes no override when the cells are revealed and nothing is changed', async () => {
    const { csrfFetch } = renderPage({ record: createRecord({ matches: pairedRound() }) });

    fireEvent.click(screen.getByRole('button', { name: "Edit Alice's record" }));
    fireEvent.click(screen.getByRole('button', { name: "Edit Bob's record" }));

    // The cells are showing the derived record, but nothing has been written behind them.
    expect(recordCell(0, 'Wins')).toHaveValue(1);
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedPayload(csrfFetch).overrides).toEqual({});
  });

  it('writes an override once a cell changes', async () => {
    const { csrfFetch } = renderPage({ record: createRecord({ matches: pairedRound() }) });

    fireEvent.click(screen.getByRole('button', { name: "Edit Alice's record" }));
    fireEvent.change(recordCell(0, 'Draws'), { target: { value: '2' } });

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // The seed the cells were revealed with, carrying the one field that was edited.
    expect(savedPayload(csrfFetch).overrides).toEqual({ Alice: { wins: 1, losses: 0, draws: 2 } });
    // Bob's cells were never touched, so his record is still his pairings'.
    expect(savedPayload(csrfFetch).overrides.Bob).toBeUndefined();
  });

  it('clears an override from pairings mode', async () => {
    const { csrfFetch } = renderPage({ record: createRecord({ matches: pairedRound(), overrides: aliceOverride() }) });

    // An override is what will be displayed, so its cells are on the row without being asked
    // for — reading a derived record the record does not use would be a lie.
    expect(roundsShown()).toBe(true);
    expect(recordCell(0, 'Wins')).toHaveValue(3);

    fireEvent.click(screen.getByRole('button', { name: "Clear Alice's record" }));

    expect(hasRecordCells(0)).toBe(false);
    expect(playerRow(0)).toHaveTextContent('1-0');

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedPayload(csrfFetch).overrides).toEqual({});
  });

  it('clears an override from final records mode', async () => {
    const { csrfFetch } = renderPage({ record: createRecord({ overrides: aliceOverride() }) });

    expect(roundsShown()).toBe(false);
    expect(recordCell(0, 'Wins')).toHaveValue(3);

    fireEvent.click(screen.getByRole('button', { name: "Clear Alice's record" }));

    // This mode is nothing but cells, so they stay — emptied, with nothing written behind.
    expect(recordCell(0, 'Wins')).toHaveValue(0);
    expect(screen.queryByRole('button', { name: "Clear Alice's record" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedPayload(csrfFetch).overrides).toEqual({});
  });

  // The page has to say plainly when an override is what will be displayed. That disclosure
  // used to be a warning in the results section, which is now rounds-only, so it sits next to
  // the record it describes.
  it('shows the pairing-derived reading next to a row that carries an override', () => {
    const { unmount } = renderPage({ record: createRecord({ matches: pairedRound(), overrides: aliceOverride() }) });

    expect(within(playerRow(0)).getByText(/From pairings: 1-0/)).toBeInTheDocument();
    // Nothing of Bob's is being overridden, so there is no precedence to disclose.
    expect(within(playerRow(1)).queryByText(/From pairings/)).not.toBeInTheDocument();

    // It belongs to the override, not to the mode, so it follows it across the toggle.
    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));
    expect(within(playerRow(0)).getByText(/From pairings: 1-0/)).toBeInTheDocument();
    unmount();

    // ...and there is nothing to compare an override against when the record has no pairings.
    renderPage({ record: createRecord({ overrides: aliceOverride() }) });
    expect(screen.queryByText(/From pairings/)).not.toBeInTheDocument();
  });

  // The endpoint's Joi schema rejects a negative win count with a raw 400, and a number input
  // reports whatever was typed regardless of its min attribute.
  it('clamps a negative entry to zero', async () => {
    const { csrfFetch } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));
    fireEvent.change(recordCell(0, 'Wins'), { target: { value: '-1' } });

    expect(recordCell(0, 'Wins')).toHaveValue(0);

    fireEvent.change(recordCell(0, 'Losses'), { target: { value: '2' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
    expect(savedPayload(csrfFetch).overrides).toEqual({ Alice: { wins: 0, losses: 2, draws: 0 } });
  });

  // The same schema is `integer()` as well as `min(0)`, and the input's step does not hold
  // back React's onChange either, so a typed or pasted "1.5" would cost the same raw 400 —
  // the whole transcribed event, not the one cell. 1.5 rather than, say, 2.5 so that a floor
  // is told apart from a round.
  it('floors a decimal entry', async () => {
    const { csrfFetch } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));
    fireEvent.change(recordCell(0, 'Wins'), { target: { value: '1.5' } });

    expect(recordCell(0, 'Wins')).toHaveValue(1);

    fireEvent.change(recordCell(0, 'Draws'), { target: { value: '0.5' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
    expect(savedPayload(csrfFetch).overrides).toEqual({ Alice: { wins: 1, losses: 0, draws: 0 } });
  });

  // Someone copying a standings sheet works straight down the list, so the cells have to be
  // reachable one row after another rather than behind sixteen expansions.
  it("tabs from one player's wins cell to the next without expanding a row", () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));
    // The page opens on the first deckless player; shut it so every row is a summary line.
    toggleRow(0);
    expect(screen.queryByLabelText('Player name')).not.toBeInTheDocument();

    const sequence = tabOrder();
    const from = sequence.indexOf(recordCell(0, 'Wins'));

    expect(from).toBeGreaterThan(-1);
    expect(sequence.slice(from, from + 5)).toEqual([
      recordCell(0, 'Wins'),
      recordCell(0, 'Losses'),
      recordCell(0, 'Draws'),
      expandToggle(1),
      recordCell(1, 'Wins'),
    ]);
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

  // After a successful save the server has rewritten draft.seats into the submitted player
  // order, so the only seatOrder that addresses those seats correctly on the next save is
  // identity. The page re-bases unconditionally, which is sound only because no player edit
  // can create a second permutation while the request is open — hence the assertions in the
  // middle. Resubmitting [1, 0] here would swap both decks a second time, silently attaching
  // each one to the wrong player.
  it('submits an identity seatOrder on the save after a reorder', async () => {
    const { csrfFetch, release } = makeDeferredCsrfFetch();
    renderPage({ csrfFetch });

    reversePlayerList();

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(screen.getByRole('button', { name: 'Shuffle Players' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add Player' })).toBeDisabled();

    await release();
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());

    // The first save carried the permutation the user actually made.
    expect(JSON.parse(`${saveCalls(csrfFetch)[0][1].body}`)).toMatchObject({
      players: [{ name: 'Bob' }, { name: 'Alice' }],
      seatOrder: [1, 0],
    });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(2));

    // ...and the second addresses the seats as the server left them.
    expect(JSON.parse(`${saveCalls(csrfFetch)[1][1].body}`)).toMatchObject({
      players: [{ name: 'Bob' }, { name: 'Alice' }],
      seatOrder: [0, 1],
    });
  });

  it('disables every player edit while a save is in flight', async () => {
    const { csrfFetch, release } = makeDeferredCsrfFetch();
    renderPage({ csrfFetch });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    expect(screen.getByRole('button', { name: 'Add Player' })).toBeEnabled();
    expect(nameField()).toBeEnabled();

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(screen.getByPlaceholderText(ADD_PLAYER_INPUT)).toBeDisabled();
    for (const name of ['Add Player', 'Shuffle Players', 'Remove Alice']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(nameField()).toBeDisabled();
    expect(trophyToggle()).toBeDisabled();

    await release();
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Add Player' })).toBeEnabled();
    expect(nameField()).toBeEnabled();
    expect(trophyToggle()).toBeEnabled();
  });

  // A rejected save leaves the record exactly where it was, so the edits come straight back.
  it('gives player editing back when a save fails', async () => {
    const { csrfFetch, release } = makeDeferredCsrfFetch({ success: 'false', message: 'Could not save' });
    renderPage({ csrfFetch });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(screen.getByRole('button', { name: 'Add Player' })).toBeDisabled();
    expect(nameField()).toBeDisabled();

    await release();
    await waitFor(() => expect(screen.getByText('Could not save')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Add Player' })).toBeEnabled();
    expect(nameField()).toBeEnabled();
  });

  // jsdom still delivers events to controls inside a disabled fieldset, where a browser would
  // not. These two pin the handler-level refusal underneath the greying out, because the
  // unconditional seatOrder re-base above depends on it holding.
  it('refuses a rename attempted while a save is in flight', async () => {
    const { csrfFetch, release } = makeDeferredCsrfFetch();
    renderPage({ csrfFetch });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    await renameOpenRow('Alicia');
    expect(playerRow(0)).toHaveTextContent('Alice');
    expect(playerRow(0)).not.toHaveTextContent('Alicia');

    await release();
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());

    await renameOpenRow('Alicia');
    expect(playerRow(0)).toHaveTextContent('Alicia');
  });

  it('refuses an add, remove or shuffle attempted while a save is in flight', async () => {
    const { csrfFetch, release } = makeDeferredCsrfFetch();
    renderPage({ csrfFetch });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    fireEvent.change(screen.getByPlaceholderText(ADD_PLAYER_INPUT), { target: { value: 'Carol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice' }));
    const random = jest.spyOn(Math, 'random').mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle Players' }));
    random.mockRestore();
    await act(async () => {});

    // Nothing applied: the rows still read in the order that was submitted.
    expect(playerRows()).toHaveLength(2);
    expect(playerRow(0)).toHaveTextContent('Alice');
    expect(JSON.parse(`${saveCalls(csrfFetch)[0][1].body}`).seatOrder).toEqual([0, 1]);

    await release();
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());

    // ...and the same shuffle goes through once the save has landed.
    reversePlayerList();
  });

  // The three below reach the one place the entry-level guards cannot: an edit started before
  // a save, applied after it. Its closure captured editsDisabled as false and the player list
  // as it stood, so the refusal has to come from the page's chokepoint reading live state.
  //
  // An add is the worst of them. applyPlayerEdit answers with a seatOrder as long as the list
  // it was handed, so a third player landing mid-save would leave three players against the
  // two-entry identity seatOrder the save-landed re-base writes — and the next save would
  // submit exactly the mismatch the re-base is predicated on being impossible.
  it('refuses an add whose @handle lookup resolves after a save has started', async () => {
    const { csrfFetch, releaseSave, releaseLookup } = makeInterleavableCsrfFetch();
    renderPage({ csrfFetch });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.change(screen.getByPlaceholderText(ADD_PLAYER_INPUT), { target: { value: '@carol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));
    await waitFor(() =>
      expect(csrfFetch.mock.calls.some(([url]) => `${url}`.startsWith('/api/user/getByUsername/'))).toBe(true),
    );

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    await releaseLookup();

    expect(playerRows()).toHaveLength(2);
    expect(screen.queryByText('Carol')).not.toBeInTheDocument();
    // Refused rather than swallowed: what was typed is still there to add again.
    expect(screen.getByPlaceholderText(ADD_PLAYER_INPUT)).toHaveValue('@carol');

    await releaseSave();
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Twice' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(2));

    // The list and the seats still describe each other.
    const next = JSON.parse(`${saveCalls(csrfFetch)[1][1].body}`);
    expect(next.players).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
    expect(next.seatOrder).toEqual([0, 1]);
    expect(next.seatOrder).toHaveLength(next.players.length);
  });

  it('refuses a rename whose @handle lookup resolves after a save has started', async () => {
    const { csrfFetch, releaseSave, releaseLookup } = makeInterleavableCsrfFetch();
    renderPage({ csrfFetch });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.change(nameField(), { target: { value: '@carol' } });
    fireEvent.blur(nameField());
    await waitFor(() =>
      expect(csrfFetch.mock.calls.some(([url]) => `${url}`.startsWith('/api/user/getByUsername/'))).toBe(true),
    );

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    await releaseLookup();

    expect(playerRow(0)).toHaveTextContent('Alice');
    expect(screen.queryByText('Carol')).not.toBeInTheDocument();

    await releaseSave();
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Twice' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(2));

    expect(JSON.parse(`${saveCalls(csrfFetch)[1][1].body}`)).toMatchObject({
      players: [{ name: 'Alice' }, { name: 'Bob' }],
      seatOrder: [0, 1],
    });
  });

  // No save anywhere near this one: the two edits are simply racing each other. The rename
  // closed over a two-player list, so applying it wholesale would put the removed player
  // back. It has to resolve against the list as it stands when the lookup lands.
  it('does not resurrect a removed player when their rename lookup resolves afterwards', async () => {
    const { csrfFetch, releaseLookup } = makeInterleavableCsrfFetch();
    renderPage({ csrfFetch });

    fireEvent.change(nameField(), { target: { value: '@carol' } });
    fireEvent.blur(nameField());
    await waitFor(() =>
      expect(csrfFetch.mock.calls.some(([url]) => `${url}`.startsWith('/api/user/getByUsername/'))).toBe(true),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice' }));
    expect(playerRows()).toHaveLength(1);

    await releaseLookup();

    expect(playerRows()).toHaveLength(1);
    expect(playerRow(0)).toHaveTextContent('Bob');
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.queryByText('Carol')).not.toBeInTheDocument();

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedPayload(csrfFetch)).toMatchObject({ players: [{ name: 'Bob' }], seatOrder: [1] });
  });

  // The server's Joi schema caps a record at 50 rounds, so the page refuses the 51st at the
  // Add control rather than letting the user type it and lose the save.
  it('refuses to add a round past the cap the server enforces', () => {
    const round = () => ({ matches: [] });

    const { unmount } = renderPage({ record: createRecord({ matches: Array.from({ length: 49 }, round) }) });
    expect(screen.getByRole('button', { name: 'Add Round' })).toBeEnabled();
    unmount();

    renderPage({ record: createRecord({ matches: Array.from({ length: 50 }, round) }) });

    expect(screen.getByRole('button', { name: 'Add Round' })).toBeDisabled();
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
