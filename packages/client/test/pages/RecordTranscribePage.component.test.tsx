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
import { SaveConflict } from '../../src/records/transcribe/transcribeState';

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

// `openRow` expands one row after mount. The page opens with every row shut, so a test that
// needs a row's body has to say which one rather than inheriting a guess.
const renderPage = ({
  record = createRecord(),
  draft,
  csrfFetch = makeCsrfFetch(),
  openRow,
}: { record?: Record; draft?: Draft; csrfFetch?: jest.Mock; openRow?: number } = {}) => {
  const result = render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <RecordTranscribePage cube={cube} record={record} draft={draft} players={[]} />
    </CSRFContext.Provider>,
  );

  if (openRow !== undefined) {
    fireEvent.click(
      within(screen.getAllByTestId('transcribe-player-row')[openRow]).getByRole('button', { name: /^Expand / }),
    );
  }

  return { ...result, csrfFetch };
};

const saveCalls = (csrfFetch: jest.Mock) => csrfFetch.mock.calls.filter(([url]) => url === SAVE_URL);

const savedPayload = (csrfFetch: jest.Mock, call = 0) => JSON.parse(`${saveCalls(csrfFetch)[call][1].body}`);

// The page now submits only the sections that changed, nested under `sections`, each keyed
// by SectionName or `overrides:<id>` / `decks:<id>` — never the whole flat record the old
// payload used to carry.
const savedSections = (csrfFetch: jest.Mock, call = 0) => savedPayload(csrfFetch, call).sections;

const saveButton = () => screen.getByRole('button', { name: 'Save' });

// One collapsible row per player. The expand toggle is the row's first button, which stays
// addressable when two rows read the same name — exactly the case the duplicate tests make.
const playerRows = () => screen.getAllByTestId('transcribe-player-row');

const playerRow = (index: number) => playerRows()[index];

const expandToggle = (index: number) => within(playerRow(index)).getByRole('button', { name: /^(Expand|Collapse) / });

const toggleRow = (index: number) => fireEvent.click(expandToggle(index));

// The three record cells live on the collapsed row, so they are addressed through it rather
// than through the one open body the other row helpers assume.
const recordCell = (index: number, field: 'Wins' | 'Losses' | 'Draws') =>
  within(playerRow(index)).getByLabelText(new RegExp(`^${field} for `)) as HTMLInputElement;

// Every row shows cells now; what varies is whether they can be typed into.
const cellsEditable = (index: number) => !recordCell(index, 'Wins').disabled;

// jsdom does not implement Tab and @testing-library/user-event is not a dependency here.
// Native tabbing visits focusable elements in document order, so this is the sequence Tab
// walks.
const tabOrder = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  ).filter((element) => !element.hasAttribute('disabled'));

// Only one row is expanded at a time, so each of these addresses the open row's body.
// Every row carries one now, so it is addressed through the row rather than globally.
const nameField = (index = 0) => within(playerRow(index)).getByLabelText('Player name') as HTMLInputElement;

// The deck column, as mainboard / sideboard counts.
const deckCell = (index: number) => within(playerRow(index)).getByTestId('deck-counts');

// The per-player override control, on the row and only in pairings mode.
const overrideToggle = (index: number) =>
  within(playerRow(index)).getByRole('button', { name: /^(Override|Stop overriding) / });

// Its hover card portals to the body, so it is read from the screen rather than the row.
// React synthesises onMouseEnter from mouseover, which is what fireEvent.mouseEnter is not.
const overrideHint = (index: number): string | null => {
  fireEvent.mouseOver(overrideToggle(index));
  return screen.queryByText('Override Player Record')?.textContent ?? null;
};

// A row is open when its deck editor is mounted; the name field is no longer the tell.
const rowExpanded = (index: number) => within(playerRow(index)).queryByText('Paste a decklist') !== null;

const trophyToggle = (index = 0) => within(playerRow(index)).getByRole('button', { name: /trophy/i });

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

  expect(nameField(0)).toHaveValue('Bob');
  expect(nameField(1)).toHaveValue('Alice');
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
    expect(nameField(0)).toHaveValue('Alice');
    expect(nameField(1)).toHaveValue('Bob');
    expect(screen.getByText('2 players')).toBeInTheDocument();

    // The decks used to be a second list of the same people under their own heading.
    expect(screen.queryByText('Decks')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('transcribe-deck-row')).toHaveLength(0);
  });

  it('shows the deck summary and the unsaved marker on the collapsed row', async () => {
    renderPage({ openRow: 0 });

    expect(deckCell(1)).toHaveTextContent('0 / 0');
    expect(playerRow(1)).not.toHaveTextContent('unsaved');

    fireEvent.change(pasteBox(0), { target: { value: '2x Lightning Bolt\nSideboard\nPyroblast' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse and Add/ }));

    await waitFor(() => expect(deckCell(0)).toHaveTextContent('2 / 1'));
    // The marker is the deck's, so it does not spread to a player whose deck is untouched.
    expect(playerRow(1)).not.toHaveTextContent('unsaved');
  });

  // Opening a row on load guesses at what the visit is for, and the guess cost a reader the
  // one row whose summary they came to check — it was replaced by a deck editor.
  it('opens with every row collapsed', () => {
    renderPage();

    expect(playerRows()).toHaveLength(2);
    expect(rowExpanded(0)).toBe(false);
    expect(rowExpanded(1)).toBe(false);
    expect(screen.queryByPlaceholderText(/Paste your decklist here/)).not.toBeInTheDocument();
  });

  it('keeps the deck editor mounted for only the expanded row', () => {
    renderPage({ openRow: 0 });

    // A pod of eight would otherwise fetch the cube's pool eight times over on mount.
    expect(screen.getAllByPlaceholderText(/Paste your decklist here/)).toHaveLength(1);
    expect(within(playerRow(0)).getByPlaceholderText(/Paste your decklist here/)).toBeInTheDocument();
    // Every row carries a name field whether open or shut, so it is the deck editor that
    // says which row is expanded.
    expect(screen.getAllByLabelText('Player name')).toHaveLength(2);
    expect(rowExpanded(1)).toBe(false);

    toggleRow(1);

    expect(screen.getAllByPlaceholderText(/Paste your decklist here/)).toHaveLength(1);
    expect(within(playerRow(1)).getByPlaceholderText(/Paste your decklist here/)).toBeInTheDocument();
    expect(rowExpanded(0)).toBe(false);
  });

  it('adds a player from the section header', async () => {
    const { csrfFetch } = renderPage();

    fireEvent.change(screen.getByPlaceholderText(ADD_PLAYER_INPUT), { target: { value: 'Carol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));

    await waitFor(() => expect(playerRows()).toHaveLength(3));
    expect(nameField(2)).toHaveValue('Carol');
    expect(screen.getByText('3 players')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(ADD_PLAYER_INPUT)).toHaveValue('');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // -1 is how the server is told this seat is new rather than moved.
    expect(savedSections(csrfFetch).players).toEqual({
      players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }],
      seatOrder: [0, 1, -1],
    });
  });

  it('resolves an @handle when adding a player', async () => {
    const { csrfFetch } = renderPage();

    fireEvent.change(screen.getByPlaceholderText(ADD_PLAYER_INPUT), { target: { value: '@carol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));

    await waitFor(() => expect(playerRows()).toHaveLength(3));
    // The account's own spelling, not the handle as typed, and still carrying the @ that
    // says this seat is a linked account rather than a bare name.
    expect(nameField(2)).toHaveValue('@Carol');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedSections(csrfFetch).players.players[2]).toEqual({ name: 'Carol', userId: 'user-carol' });
  });

  it('removes a player from their row body', async () => {
    const { csrfFetch } = renderPage({ openRow: 0 });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice' }));

    expect(playerRows()).toHaveLength(1);
    expect(nameField(0)).toHaveValue('Bob');
    expect(screen.getByText('1 player')).toBeInTheDocument();

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // Bob keeps pointing at the draft seat he actually sat in.
    expect(savedSections(csrfFetch).players).toEqual({ players: [{ name: 'Bob' }], seatOrder: [1] });
  });

  it('closes the expansion when the expanded player is removed', () => {
    renderPage({ openRow: 0 });

    expect(rowExpanded(0)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice' }));

    // The body that held the remove control belonged to a player who is gone; leaving the
    // expansion on that index would open it onto whoever moved up into the seat.
    expect(rowExpanded(0)).toBe(false);
    expect(screen.queryByPlaceholderText(/Paste your decklist here/)).not.toBeInTheDocument();
    expect(playerRows()).toHaveLength(1);
  });

  it('shuffles from the section header', async () => {
    const { csrfFetch } = renderPage();

    reversePlayerList();

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedSections(csrfFetch).players).toEqual({
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
    renderPage({ openRow: 0 });

    fireEvent.change(pasteBox(0), { target: { value: '2x Lightning Bolt\nSideboard\nPyroblast' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse and Add/ }));
    await waitFor(() => expect(deckCell(0)).toHaveTextContent('2 / 1'));

    dragPlayer(0, 1);

    expect(nameField(0)).toHaveValue('Bob');
    expect(deckCell(0)).toHaveTextContent('0 / 0');
    // The deck is keyed by position, so it only stays with Alice if the move re-keys it.
    expect(nameField(1)).toHaveValue('Alice');
    expect(deckCell(1)).toHaveTextContent('2 / 1');
  });

  it('submits a seatOrder matching the new order after a reorder', async () => {
    const { csrfFetch } = renderPage();

    dragPlayer(1, 0);

    expect(nameField(0)).toHaveValue('Bob');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // Each player still points at the draft seat they came from, which is what carries their
    // deck across on the server.
    expect(savedSections(csrfFetch).players).toEqual({
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

    expect(nameField(0)).toHaveValue('Alice');
    expect(nameField(1)).toHaveValue('Bob');

    await release();
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());

    // ...and the same drop goes through once the save has landed.
    dragPlayer(0, 1);

    expect(nameField(0)).toHaveValue('Bob');
    expect(nameField(1)).toHaveValue('Alice');
  });

  // The expansion is a position, and a reorder moves players under it. Leaving it where it
  // was would hand one player's half-typed name and paste to whoever landed in their place.
  it('keeps the expansion on the same player after a reorder', () => {
    renderPage({ openRow: 0 });

    // Alice's row opens on load as the first player still missing a deck.
    expect(within(playerRow(0)).getByLabelText('Player name')).toHaveValue('Alice');
    fireEvent.change(pasteBox(0), { target: { value: "Alice's deck" } });

    dragPlayer(0, 1);

    expect(rowExpanded(0)).toBe(false);
    expect(nameField(1)).toHaveValue('Alice');
    expect(pasteBox(1)).toHaveValue("Alice's deck");
  });

  // The field is mounted for every row, open or shut, and the rows are keyed by seat rather
  // than by player — so a reorder hands one component a different player without remounting
  // it. An untracked draft would leave Alice's name sitting over Bob's row and rename him to
  // it on the next blur.
  it("re-seeds a row's name field when a reorder moves another player into it", () => {
    const { csrfFetch } = renderPage();

    dragPlayer(0, 1);

    expect(nameField(0)).toHaveValue('Bob');
    expect(nameField(1)).toHaveValue('Alice');

    // Nothing was typed, so blurring the moved-into field must not commit a rename.
    fireEvent.blur(nameField(0));
    fireEvent.click(saveButton());
    return waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1)).then(() => {
      expect(savedSections(csrfFetch).players.players).toEqual([{ name: 'Bob' }, { name: 'Alice' }]);
    });
  });

  // The row body holds the name input and the paste box. Were the row itself the drag target,
  // a drag begun in either would start a sort instead of selecting text.
  it('does not put drag listeners on the name input', () => {
    renderPage({ openRow: 0 });

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

    expect(nameField(0)).toHaveValue('Alicia');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedSections(csrfFetch).players.players).toEqual([{ name: 'Alicia' }, { name: 'Bob' }]);
  });

  it('renames a player committing on Enter', async () => {
    const { csrfFetch } = renderPage();

    await renameOpenRow('Alicia', 'enter');

    expect(nameField(0)).toHaveValue('Alicia');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedSections(csrfFetch).players.players).toEqual([{ name: 'Alicia' }, { name: 'Bob' }]);
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
    expect(nameField(0)).toHaveValue('Bob');
    // ...and the list underneath is untouched, so there is no second Bob, nothing page-wide
    // to say, and nothing to save. The row still belongs to Alice — only the draft says Bob.
    expect(within(playerRow(0)).getByLabelText('Drag Alice to reorder')).toBeInTheDocument();
    expect(nameField(1)).toHaveValue('Bob');
    expect(screen.queryByText(/Two players cannot share a name/)).not.toBeInTheDocument();
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();
  });

  it('refuses a rename that collides only in case', async () => {
    renderPage();

    await renameOpenRow('bob');

    expect(screen.getByText('Another player is already named bob')).toBeInTheDocument();
    expect(within(playerRow(0)).getByLabelText('Drag Alice to reorder')).toBeInTheDocument();
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();
  });

  // The whole of the bug: a typo and its correction, one field at a time, which is the only
  // way to swap two names now the batch editor is gone. Since the typo is refused as a
  // collision and the correction then writes a player back to the name it already had, both
  // are no-ops — the payload after them must be indistinguishable from one that never
  // touched the player list, i.e. nothing beyond the overview we actually edited.
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
    // Only the name changed, so nothing else should even be in the payload.
    expect(Object.keys(baseline.sections)).toEqual(['overview']);
    clean.unmount();

    const typo = renderPage({ record: record() });

    // The typo...
    await renameOpenRow('Bob');
    // ...and the correction a second later, which is what used to make the damage
    // unreportable: after it there is no duplicate for validationErrors to catch.
    await renameOpenRow('Alice');

    expect(playerRows()).toHaveLength(2);
    expect(nameField(0)).toHaveValue('Alice');
    expect(nameField(1)).toHaveValue('Bob');
    expect(screen.queryByText(/Two players cannot share a name/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(typo.csrfFetch)).toHaveLength(1));
    const payload = savedPayload(typo.csrfFetch);

    // Spelled out as well as compared, so the failure names what was destroyed rather than
    // only that two payloads differ.
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
    expect(savedSections(csrfFetch).players.players).toEqual([{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }]);
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

  it('toggles a trophy from the row itself', async () => {
    const { csrfFetch } = renderPage();

    // Rendered on every row whether or not it is held, so there is something to press in
    // the first place — the pressed state is what says who won.
    expect(trophyToggle(0)).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(trophyToggle(0));

    expect(trophyToggle(0)).toHaveAttribute('aria-pressed', 'true');
    expect(trophyToggle(1)).toHaveAttribute('aria-pressed', 'false');

    // ...and back off again, so the control is a toggle rather than a one-way award.
    fireEvent.click(trophyToggle(0));
    expect(trophyToggle(0)).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(trophyToggle(0));
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
    expect(savedSections(csrfFetch).trophy).toEqual({ trophy: ['Alice'] });
  });

  // The endpoint refuses a save that adds, removes or reorders players on a played draft, so
  // the page must not put those controls in front of the user at all.
  it('offers no add, remove or shuffle when seats are not editable', () => {
    const { unmount } = renderPage({ openRow: 0 });
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

    expect(nameField(0)).toHaveValue('Alicia');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    const sections = savedSections(csrfFetch);
    expect(sections.players).toEqual({ players: [{ name: 'Alicia' }, { name: 'Bob' }], seatOrder: [0, 1] });
    expect(Object.keys(sections).some((key) => key.startsWith('decks:'))).toEqual(false);
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
    renderPage({ draft: playedDraft(), openRow: 0 });

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
    // Only the name changed — the played draft's seats never had a chance to be dirtied.
    expect(savedSections(csrfFetch)).toEqual({
      overview: { name: 'Renamed Night', date: 1700000000000, description: 'Eight players, three rounds' },
    });
  });

  // A rename re-keys every name-keyed section it touches, and the player's own override
  // section stays keyed by seat position (this record has no player ids) — so a rename alone
  // does not resend it: the win/loss/draw value itself has not moved.
  it('re-keys pairings and trophies when a player is renamed, without resending an unchanged override', async () => {
    const record = createRecord({
      matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] as [number, number, number] }] }],
      trophy: ['Alice'],
      overrides: { Alice: { wins: 3, losses: 0, draws: 0 } },
    });
    const { csrfFetch } = renderPage({ record });

    await renameOpenRow('Alicia');

    expect(nameField(0)).toHaveValue('Alicia');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    const sections = savedSections(csrfFetch);
    // The seat still holds whoever sat there, so the draft is not reshuffled by a rename.
    expect(sections.players).toEqual({ players: [{ name: 'Alicia' }, { name: 'Bob' }], seatOrder: [0, 1] });
    expect(sections.rounds.matches[0].matches[0].p1).toBe('Alicia');
    expect(sections.trophy).toEqual({ trophy: ['Alicia'] });
    expect(sections['overrides:0']).toBeUndefined();
  });

  // Only one deck editor is mounted at a time, so the paste box is unmounted whenever another
  // player's row is opened. Holding its text inside the editor would throw a half-entered
  // decklist away.
  it('keeps a paste across a collapse and re-expand', () => {
    renderPage({ openRow: 0 });

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
    renderPage({ csrfFetch: makeCsrfFetch({ success: 'true' }, ['Notacard']), openRow: 0 });

    fireEvent.change(pasteBox(0), { target: { value: 'Lightning Bolt\nNotacard' } });
    fireEvent.click(screen.getByRole('button', { name: /Parse and Add/ }));

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
    renderPage({ openRow: 0 });

    fireEvent.change(pasteBox(0), { target: { value: "Alice's deck" } });
    toggleRow(1);
    fireEvent.change(pasteBox(1), { target: { value: "Bob's deck" } });
    toggleRow(0);

    expect(pasteBox(0)).toHaveValue("Alice's deck");
    toggleRow(1);
    expect(pasteBox(1)).toHaveValue("Bob's deck");
  });

  it('submits a pasted decklist under the seat it was entered against', async () => {
    const { csrfFetch } = renderPage({ openRow: 0 });

    fireEvent.change(screen.getByPlaceholderText(/Paste your decklist here/), {
      target: { value: '2x Lightning Bolt\nSideboard\nPyroblast' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Parse and Add/ }));

    await waitFor(() => expect(screen.getByText('Unsaved changes')).toBeInTheDocument());

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // Keyed by seat index (this record has no player ids): seat 0 is Alice, whose row the
    // paste went into. Bob's untouched seat is left out entirely rather than re-written as
    // an empty deck.
    expect(savedSections(csrfFetch)).toEqual({
      'decks:0': {
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

  // The mode governs which editor is on screen and nothing else, so round-tripping through
  // records mode and back without any other edit must leave no trace of its own — no stray
  // overrides or rounds section beyond the one real change, the name.
  it('submits an unchanged payload after switching to final records and back', async () => {
    const record = () => createRecord({ matches: pairedRound(), overrides: aliceOverride() });

    const direct = renderPage({ record: record() });
    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(direct.csrfFetch)).toHaveLength(1));
    const baseline = savedPayload(direct.csrfFetch);
    direct.unmount();

    // Only the name changed from what was stored, mode untouched.
    expect(Object.keys(baseline.sections)).toEqual(['overview']);

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

    expect(cellsEditable(1)).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    // Bob's row is shut, and his record is still typeable: making someone expand sixteen
    // rows in turn would regress the standings-sheet case this mode exists for.
    expect(rowExpanded(1)).toBe(false);
    expect(recordCell(1, 'Wins')).toHaveValue(0);
    expect(recordCell(1, 'Losses')).toHaveValue(0);
    expect(recordCell(1, 'Draws')).toHaveValue(0);
  });

  // Three bare number boxes per row, times sixteen players, with no column heading. The
  // cells stay unlabelled to keep the row on one line, so the list says once what they are
  // and each cell names itself on hover.
  it('heads the record columns, once above the list and on each cell', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    // Every row carries cells in both modes, so the headings are there from the start.
    const headings = screen.getByTestId('record-column-headings');
    expect(within(headings).getByText('Wins')).toBeInTheDocument();
    expect(within(headings).getByText('Losses')).toBeInTheDocument();
    expect(within(headings).getByText('Draws')).toBeInTheDocument();
    expect(recordCell(1, 'Wins')).toHaveAttribute('title', 'Wins');
    expect(recordCell(1, 'Losses')).toHaveAttribute('title', 'Losses');
    expect(recordCell(1, 'Draws')).toHaveAttribute('title', 'Draws');

    // Every row carries cells in final records mode, so the headings are there from the start.
    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));
    expect(screen.getByTestId('record-column-headings')).toBeInTheDocument();
    expect(recordCell(0, 'Wins')).toHaveAttribute('title', 'Wins');
  });

  it('aligns each column heading with the cell beneath it', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });
    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    // A heading that is not the same width as its column is not a heading, it is a caption.
    const headings = screen.getByTestId('record-column-headings');
    for (const label of ['Wins', 'Losses', 'Draws']) {
      expect(within(headings).getByText(label)).toHaveClass('w-20');
    }
    expect(recordCell(0, 'Wins').parentElement?.parentElement).toHaveClass('w-20');
  });

  it('keeps the record cells rightmost, with the deck summary to their left', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });
    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    // The cells sit at the same x on every row only if everything that varies in width —
    // the deck summary, a Clear control, a from-pairings reading — is left of them.
    const row = playerRow(0);
    const summary = deckCell(0);
    const wins = recordCell(0, 'Wins');
    expect(summary.compareDocumentPosition(wins) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('writes an override once a cell changes', async () => {
    const { csrfFetch } = renderPage({ record: createRecord({ matches: pairedRound() }) });
    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    fireEvent.change(recordCell(0, 'Draws'), { target: { value: '2' } });

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // Started from nothing rather than from Alice's 1-0, because this mode does not read the
    // matches — and Bob, untouched, is given an explicit empty record for the same reason.
    const sections = savedSections(csrfFetch);
    expect(sections['overrides:0']).toEqual({ wins: 0, losses: 0, draws: 2 });
    expect(sections['overrides:1']).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  it('turns a pairings-mode override on from the row, seeded from the pairings', async () => {
    const { csrfFetch } = renderPage({ record: createRecord({ matches: pairedRound() }) });

    expect(overrideToggle(0)).toHaveAttribute('aria-pressed', 'false');
    expect(cellsEditable(0)).toBe(false);
    // A pencil on a row of numbers does not say what it edits.
    expect(overrideHint(0)).toBe('Override Player Record');

    fireEvent.click(overrideToggle(0));

    // Seeded from the pairings, so turning it on does not blank the record to 0-0-0.
    expect(cellsEditable(0)).toBe(true);
    expect(recordCell(0, 'Wins')).toHaveValue(1);
    // One row at a time: Bob is still on his pairings.
    expect(cellsEditable(1)).toBe(false);

    fireEvent.change(recordCell(0, 'Draws'), { target: { value: '2' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    const sections = savedSections(csrfFetch);
    expect(sections['overrides:0']).toEqual({ wins: 1, losses: 0, draws: 2 });
    // The matches are untouched, so Bob's pairings-derived record is not resubmitted either.
    expect(sections['overrides:1']).toBeUndefined();
    expect(sections.rounds).toBeUndefined();
  });

  it('hands a player back to their pairings when the override is turned off', async () => {
    const { csrfFetch } = renderPage({
      record: createRecord({ matches: pairedRound(), overrides: aliceOverride() }),
    });

    // A stored override is what the record reads, so the cells show it rather than the
    // pairings, and the control is already on.
    expect(roundsShown()).toBe(true);
    expect(overrideToggle(0)).toHaveAttribute('aria-pressed', 'true');
    expect(recordCell(0, 'Wins')).toHaveValue(3);
    expect(cellsEditable(0)).toBe(true);
    // The clear button it replaced is gone from the row.
    expect(screen.queryByRole('button', { name: "Clear Alice's record" })).not.toBeInTheDocument();

    fireEvent.click(overrideToggle(0));

    expect(cellsEditable(0)).toBe(false);
    expect(recordCell(0, 'Wins')).toHaveValue(1);
    expect(recordCell(0, 'Losses')).toHaveValue(0);

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // Clearing a stored override back off is itself a change — null tells the server to
    // remove it, distinct from the key being absent (unchanged).
    expect(savedSections(csrfFetch)['overrides:0']).toBeNull();
  });

  // The row carries the player's name, record and trophy, so everything left in the body is
  // about their deck — and the heading is what says so.
  it('heads the row body as the deck, beside removing the player', () => {
    renderPage({ openRow: 0 });

    const heading = within(playerRow(0)).getByText('Deck');
    const remove = within(playerRow(0)).getByRole('button', { name: 'Remove Alice' });
    // Same flex row, heading first.
    expect(heading.closest('div')).toBe(remove.closest('div'));
    expect(heading.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Neither control is shared. The toggle filters one autocomplete's suggestions; the board
  // selector sets where a typed card and the basics below it land. The paste box routes
  // itself from section markers and the scanner from its own per-card checkboxes, so a line
  // of controls above both columns claimed a reach neither of them has.
  it('keeps the board selector and cube filter with the field they serve', () => {
    renderPage({ openRow: 0 });

    const row = playerRow(0);
    const addCard = within(row).getByPlaceholderText(/Card to Add to/);

    for (const control of [within(row).getByLabelText('Board'), within(row).getByLabelText('Show Cards not in Cube')]) {
      expect(addCard.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(control.compareDocumentPosition(pasteBox(0)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    // Removing the player is a row action, and all that is left on its own line.
    expect(within(row).queryByTestId('deck-shared-controls')).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Remove Alice' })).toBeInTheDocument();
  });

  it('offers no override control in final records mode, where every cell is already typeable', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    expect(within(playerRow(0)).queryByRole('button', { name: /[Oo]verrid/ })).not.toBeInTheDocument();
    expect(cellsEditable(0)).toBe(true);
  });

  // "Final records only" has to mean it: playerRecord prefers an override and falls back to
  // the pairings, so a player left untouched would silently be scored off the matches this
  // mode exists to ignore.
  it('ignores the matches entirely in final records mode', async () => {
    const { csrfFetch } = renderPage({ record: createRecord({ matches: pairedRound() }) });

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

    // Alice won her match, but this mode does not read matches — her record starts empty.
    expect(recordCell(0, 'Wins')).toHaveValue(0);
    expect(recordCell(1, 'Losses')).toHaveValue(0);

    fireEvent.change(recordCell(0, 'Wins'), { target: { value: '3' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    // Every player is given an explicit record, including the ones left alone, so nothing
    // falls back to the pairings.
    const sections = savedSections(csrfFetch);
    expect(sections['overrides:0']).toEqual({ wins: 3, losses: 0, draws: 0 });
    expect(sections['overrides:1']).toEqual({ wins: 0, losses: 0, draws: 0 });
    // ...and the matches are untouched, so switching back restores them from what is stored.
    expect(sections.rounds).toBeUndefined();
  });

  // Switching mode changes what Save writes, so it is a change like any other.
  // Adding a round is an action on the section, not the last row of its list — at the bottom
  // it sat below however many rounds were already there, which is where it is least reachable.
  it('adds a round from the section header', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    const header = screen.getByRole('button', { name: 'Add Round' }).closest('.border-b');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByText('Rounds')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Round' }));
    expect(screen.getByText('Round 2')).toBeInTheDocument();
  });

  // A round with no matches is a heading over an empty body, and the only thing to do with
  // it is make the row that was already asked for.
  it('seeds a new round with one match', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Add Round' }));

    expect(screen.getAllByLabelText('Player 1')).toHaveLength(1);
    // Both seats start unassigned, so both win cells are named for the same placeholder.
    expect(screen.getAllByLabelText('Unknown Opponent Wins')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Remove match 1' })).toBeInTheDocument();
  });

  // With the add control moved to the header, a record with no rounds would otherwise show
  // an empty card body and nothing to say what belongs in it.
  it('says what an empty rounds section is for', () => {
    renderPage();

    expect(screen.getByText(/No rounds yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Round' }));

    expect(screen.queryByText(/No rounds yet/)).not.toBeInTheDocument();
    expect(screen.getByText('Round 1')).toBeInTheDocument();
  });

  it('counts a change of results mode as unsaved work', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pairings' }));
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument();
  });

  it('empties a record in final records mode by typing over it', async () => {
    const { csrfFetch } = renderPage({ record: createRecord({ overrides: aliceOverride() }) });

    // A record carrying overrides and no pairings opens in this mode.
    expect(roundsShown()).toBe(false);
    expect(recordCell(0, 'Wins')).toHaveValue(3);

    // The cells are the only control here, so clearing one is typing a zero into it — there
    // is no second reading to fall back to, which is what Clear used to mean.
    fireEvent.change(recordCell(0, 'Wins'), { target: { value: '0' } });

    expect(recordCell(0, 'Wins')).toHaveValue(0);

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    const sections = savedSections(csrfFetch);
    expect(sections['overrides:0']).toEqual({ wins: 0, losses: 0, draws: 0 });
    // Bob never had a stored override and the page opened in records mode already — nothing
    // about his entry changed, so it must not be sent even though records mode would
    // synthesize a 0-0-0 for him if asked. A record untouched since it opened must not report
    // every override-less player as edited.
    expect(sections['overrides:1']).toBeUndefined();
  });

  // The page has to say plainly when an override is what will be displayed. That disclosure
  // used to be a warning in the results section, which is now rounds-only, so it sits next to
  // the record it describes.
  // The override switch hides what it is replacing, so the reading it displaces is stated
  // right beside it rather than left for the user to work out from the rounds below.
  // The card is read in place, where the row it sits on already says whose record it is;
  // the accessible name carries the player, so two rows are never ambiguous to a reader.
  it('names the player in the override control without repeating it in the card', () => {
    renderPage({ record: createRecord({ matches: pairedRound() }) });

    expect(overrideToggle(1)).toHaveAccessibleName('Override Bob\u2019s record');
    expect(overrideHint(1)).toBe('Override Player Record');

    fireEvent.click(overrideToggle(1));
    expect(overrideToggle(1)).toHaveAccessibleName('Stop overriding Bob\u2019s record');
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
    expect(savedSections(csrfFetch)['overrides:0']).toEqual({ wins: 0, losses: 2, draws: 0 });
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
    expect(savedSections(csrfFetch)['overrides:0']).toEqual({ wins: 1, losses: 0, draws: 0 });
  });

  // Someone copying a standings sheet works straight down the list, so the cells have to be
  // reachable one row after another rather than behind sixteen expansions.
  it("tabs from one player's wins cell to the next without expanding a row", () => {
    renderPage({ openRow: 0 });

    fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));
    // The page opens on the first deckless player; shut it so every row is a summary line.
    toggleRow(0);
    expect(rowExpanded(0)).toBe(false);

    const sequence = tabOrder();
    const from = sequence.indexOf(recordCell(0, 'Wins'));

    expect(from).toBeGreaterThan(-1);
    // Three cells, then the row's chevron, then the next row's name and trophy — four
    // keystrokes between one player's wins and the next, with no expansion in between.
    expect(sequence.slice(from, from + 7)).toEqual([
      recordCell(0, 'Wins'),
      recordCell(0, 'Losses'),
      recordCell(0, 'Draws'),
      expandToggle(0),
      nameField(1),
      trophyToggle(1),
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
    // Only the name changed — the player list, seat order and decks are all still what was
    // loaded, so nothing else belongs in the payload.
    expect(savedSections(csrfFetch)).toEqual({
      overview: { name: 'Renamed Night', date: 1700000000000, description: 'Eight players, three rounds' },
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
    expect(savedSections(csrfFetch, 0).players).toEqual({
      players: [{ name: 'Bob' }, { name: 'Alice' }],
      seatOrder: [1, 0],
    });

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(2));

    // ...and the second addresses the seats as the server left them — identity already
    // matches what is now the baseline, so the players section is not resubmitted at all.
    expect(savedSections(csrfFetch, 1)).toEqual({
      overview: { name: 'Renamed Night', date: 1700000000000, description: 'Eight players, three rounds' },
    });
  });

  it('disables every player edit while a save is in flight', async () => {
    const { csrfFetch, release } = makeDeferredCsrfFetch();
    renderPage({ csrfFetch, openRow: 0 });

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
    expect(nameField(0)).toHaveValue('Alice');
    expect(nameField(0)).not.toHaveValue('Alicia');

    await release();
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());

    await renameOpenRow('Alicia');
    expect(nameField(0)).toHaveValue('Alicia');
  });

  it('refuses an add, remove or shuffle attempted while a save is in flight', async () => {
    const { csrfFetch, release } = makeDeferredCsrfFetch();
    renderPage({ csrfFetch, openRow: 0 });

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

    // Nothing applied: the rows still read in the order that was submitted, and the save in
    // flight carried only the name — the blocked edits never touched the players section.
    expect(playerRows()).toHaveLength(2);
    expect(nameField(0)).toHaveValue('Alice');
    expect(savedSections(csrfFetch, 0).players).toBeUndefined();

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

    // The list and the seats still describe each other — the add never applied, so the
    // second save carries nothing about players at all, only the second rename.
    const next = savedSections(csrfFetch, 1);
    expect(next.players).toBeUndefined();
    expect(next.overview).toEqual({
      name: 'Renamed Twice',
      date: 1700000000000,
      description: 'Eight players, three rounds',
    });
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

    // The refusal leaves the typed handle in the field to be retried, and the player
    // underneath it untouched — no Carol was ever added to the list.
    expect(nameField(0)).toHaveValue('@carol');
    expect(within(playerRow(0)).getByLabelText('Drag Alice to reorder')).toBeInTheDocument();
    expect(playerRows()).toHaveLength(2);

    await releaseSave();
    await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Twice' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(2));

    // The rename never applied, so the second save carries nothing about players at all.
    expect(savedSections(csrfFetch, 1)).toEqual({
      overview: { name: 'Renamed Twice', date: 1700000000000, description: 'Eight players, three rounds' },
    });
  });

  // No save anywhere near this one: the two edits are simply racing each other. The rename
  // closed over a two-player list, so applying it wholesale would put the removed player
  // back. It has to resolve against the list as it stands when the lookup lands.
  it('does not resurrect a removed player when their rename lookup resolves afterwards', async () => {
    const { csrfFetch, releaseLookup } = makeInterleavableCsrfFetch();
    renderPage({ csrfFetch, openRow: 0 });

    fireEvent.change(nameField(), { target: { value: '@carol' } });
    fireEvent.blur(nameField());
    await waitFor(() =>
      expect(csrfFetch.mock.calls.some(([url]) => `${url}`.startsWith('/api/user/getByUsername/'))).toBe(true),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Alice' }));
    expect(playerRows()).toHaveLength(1);

    await releaseLookup();

    expect(playerRows()).toHaveLength(1);
    expect(nameField(0)).toHaveValue('Bob');
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.queryByText('Carol')).not.toBeInTheDocument();

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

    expect(savedSections(csrfFetch).players).toEqual({ players: [{ name: 'Bob' }], seatOrder: [1] });
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

  // Task 6 taught the endpoint to apply the sections nobody else touched and refuse the ones
  // that moved, answering with { applied, conflicts, record }. These cover what the page does
  // with that: nothing the user typed is lost, every refused section is named and marked in
  // place, and the two resolutions behave as the design requires.
  describe('conflict reporting and resolution', () => {
    const overviewConflict = (storedName: string): SaveConflict => ({
      section: 'overview',
      stored: { name: storedName, date: 1700000000000, description: 'Eight players, three rounds' },
    });

    it('keeps every edit on the page when a section conflicts', async () => {
      const csrfFetch = makeCsrfFetch({
        success: 'true',
        applied: [],
        conflicts: [overviewConflict('Someone else renamed this')],
        record: {},
      });
      renderPage({ csrfFetch });

      fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'My typed name' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
      await waitFor(() => expect(screen.getByTestId('section-conflict-overview')).toBeInTheDocument());

      // A conflict is reported — not applied — so nothing the user typed is thrown away, and
      // the record still reads as having unsaved work.
      expect(screen.getByPlaceholderText(NAME_INPUT)).toHaveValue('My typed name');
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });

    it('names each refused section in an alert', async () => {
      const csrfFetch = makeCsrfFetch({
        success: 'true',
        applied: [],
        conflicts: [overviewConflict('Other'), { section: 'trophy', stored: { trophy: [] } }],
        record: {},
      });
      renderPage({ csrfFetch });

      fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

      const alert = within(await screen.findByTestId('conflicts-alert'));
      expect(alert.getByText('Event details')).toBeInTheDocument();
      expect(alert.getByText('Trophy')).toBeInTheDocument();
    });

    it("marks the conflicted section's card and leaves the others unmarked", async () => {
      const csrfFetch = makeCsrfFetch({
        success: 'true',
        applied: [],
        conflicts: [overviewConflict('Other')],
        record: {},
      });
      renderPage({ csrfFetch });

      fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

      expect(await screen.findByTestId('section-conflict-overview')).toBeInTheDocument();
      expect(screen.queryByTestId('section-conflict-players')).not.toBeInTheDocument();
      expect(screen.queryByTestId('section-conflict-rounds')).not.toBeInTheDocument();
      expect(screen.queryByTestId('section-conflict-trophy')).not.toBeInTheDocument();
    });

    // `trophy` applying with a response value that disagrees with what was submitted proves
    // the re-baseline read from the response — a bug that re-baselined from the submission
    // instead would leave `seeded` matching `state`, and this save would read clean.
    it('re-baselines applied sections from the response, not the submission', async () => {
      const csrfFetch = makeCsrfFetch({
        success: 'true',
        applied: ['trophy'],
        conflicts: [],
        record: { trophy: { trophy: ['Alice', 'Bob'] } },
      });
      renderPage({ csrfFetch });

      fireEvent.click(trophyToggle(0));
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
      expect(savedSections(csrfFetch).trophy).toEqual({ trophy: ['Alice'] });

      // Waits for the save to fully settle (rather than for either outcome text directly —
      // "Unsaved changes" is also what the page shows *before* the save lands, so asserting
      // on it through `waitFor` without first waiting for settlement would pass on that
      // transient state alone, proving nothing about what happened after the response arrived).
      await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument());

      // The server's echo (['Alice', 'Bob']) differs from what was submitted (['Alice']) — a
      // bug that re-baselined from the submission instead would read this save as fully clean
      // and show "Record saved."; reading from the response correctly leaves it dirty, since
      // the workspace does not yet show Bob trophied.
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      expect(screen.queryByText('Record saved.')).not.toBeInTheDocument();
    });

    it('discards the local edit and takes the stored value on "keep theirs"', async () => {
      const csrfFetch = makeCsrfFetch({
        success: 'true',
        applied: [],
        conflicts: [overviewConflict('Server Name')],
        record: {},
      });
      renderPage({ csrfFetch });

      fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'My typed name' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

      const marker = within(await screen.findByTestId('section-conflict-overview'));
      fireEvent.click(marker.getByText('Keep theirs'));

      expect(screen.getByPlaceholderText(NAME_INPUT)).toHaveValue('Server Name');
      expect(screen.getByText('No unsaved changes')).toBeInTheDocument();
      expect(screen.queryByTestId('section-conflict-overview')).not.toBeInTheDocument();
    });

    it('re-baselines without discarding on "keep mine", so the next save overwrites', async () => {
      const responses = [
        { success: 'true', applied: [], conflicts: [overviewConflict('Server Name')], record: {} },
        {
          success: 'true',
          applied: ['overview'],
          conflicts: [],
          record: {
            overview: { name: 'My typed name', date: 1700000000000, description: 'Eight players, three rounds' },
          },
        },
      ];
      const csrfFetch: jest.Mock = jest.fn(async (url: RequestInfo) => {
        if (url === SAVE_URL) {
          const callIndex = saveCalls(csrfFetch).length - 1;
          return { ok: true, json: async () => responses[callIndex] } as Response;
        }
        return { ok: false, status: 404, json: async () => ({ success: 'false' }) } as Response;
      });
      renderPage({ csrfFetch });

      fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'My typed name' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

      const marker = within(await screen.findByTestId('section-conflict-overview'));
      fireEvent.click(marker.getByText('Keep mine'));

      // Keep mine never discards the typed value, and the section stays dirty — a deliberate
      // second action is required before anything is resubmitted.
      expect(screen.getByPlaceholderText(NAME_INPUT)).toHaveValue('My typed name');
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      expect(screen.queryByTestId('section-conflict-overview')).not.toBeInTheDocument();

      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(2));
      expect(savedSections(csrfFetch, 1).overview).toEqual({
        name: 'My typed name',
        date: 1700000000000,
        description: 'Eight players, three rounds',
      });
      await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());
    });

    it('reports the save as successful when nothing conflicted', async () => {
      const csrfFetch = makeCsrfFetch({
        success: 'true',
        applied: ['overview'],
        conflicts: [],
        record: {
          overview: { name: 'Renamed Night', date: 1700000000000, description: 'Eight players, three rounds' },
        },
      });
      renderPage({ csrfFetch });

      fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'Renamed Night' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));

      expect(await screen.findByText('Record saved.')).toBeInTheDocument();
      expect(screen.queryByTestId('conflicts-alert')).not.toBeInTheDocument();
      expect(screen.getByText('No unsaved changes')).toBeInTheDocument();
    });

    // A failed resubmission must not read as the earlier conflict having resolved itself —
    // the section stays dirty and will be resubmitted, so its marker has to stay visible too.
    it('keeps the conflict marker visible when a resubmission fails', async () => {
      const responses = [
        { success: 'true', applied: [], conflicts: [overviewConflict('Server Name')], record: {} },
        { success: 'false', message: 'Could not save this record.' },
      ];
      const csrfFetch: jest.Mock = jest.fn(async (url: RequestInfo) => {
        if (url === SAVE_URL) {
          const callIndex = saveCalls(csrfFetch).length - 1;
          return { ok: true, json: async () => responses[callIndex] } as Response;
        }
        return { ok: false, status: 404, json: async () => ({ success: 'false' }) } as Response;
      });
      renderPage({ csrfFetch });

      fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'My typed name' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
      expect(await screen.findByTestId('section-conflict-overview')).toBeInTheDocument();

      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(2));
      await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument());

      expect(await screen.findByText('Could not save this record.')).toBeInTheDocument();
      // The resubmission's own failure must not have discarded the still-outstanding conflict
      // from the first save.
      expect(screen.getByTestId('section-conflict-overview')).toBeInTheDocument();
    });

    // Resolving the very last conflict can immediately reach the "clean save" footer condition
    // (no conflicts, nothing dirty) — the message from the save that reported them must not
    // linger into that success alert and read as if a section is still contested.
    it('clears the stale conflict message once the last conflict is resolved', async () => {
      const csrfFetch = makeCsrfFetch({
        success: 'true',
        applied: [],
        conflicts: [overviewConflict('Server Name')],
        record: {},
      });
      renderPage({ csrfFetch });

      fireEvent.change(screen.getByPlaceholderText(NAME_INPUT), { target: { value: 'My typed name' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
      expect(
        await screen.findByText('Some sections could not be saved — someone else changed them. Resolve them below.'),
      ).toBeInTheDocument();

      const marker = within(await screen.findByTestId('section-conflict-overview'));
      fireEvent.click(marker.getByText('Keep theirs'));

      await waitFor(() => expect(screen.getByText('No unsaved changes')).toBeInTheDocument());
      expect(
        screen.queryByText('Some sections could not be saved — someone else changed them. Resolve them below.'),
      ).not.toBeInTheDocument();
    });

    // The Rounds card, and the only resolution control for a `rounds` conflict, does not exist
    // in the DOM in "Final records only" mode — the marker itself must not depend on it.
    it('keeps the rounds conflict marker reachable from final records only mode', async () => {
      const csrfFetch = makeCsrfFetch({
        success: 'true',
        applied: [],
        conflicts: [{ section: 'rounds', stored: { matches: [] } }],
        record: {},
      });
      renderPage({ record: createRecord({ matches: pairedRound() }), csrfFetch });

      // Dirty `rounds` while still in pairings mode, where its editor lives, then save.
      fireEvent.click(screen.getByRole('button', { name: 'Add Round' }));
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveCalls(csrfFetch)).toHaveLength(1));
      expect(await screen.findByTestId('section-conflict-rounds')).toBeInTheDocument();

      // Switching modes unmounts the Rounds card and its editor — the marker must not go with
      // it, or the user is told about a conflict they now have no way to act on.
      fireEvent.click(screen.getByRole('button', { name: 'Final records only' }));

      expect(roundsShown()).toBe(false);
      expect(screen.getByTestId('section-conflict-rounds')).toBeInTheDocument();
    });
  });
});
