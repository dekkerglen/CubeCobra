import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';
import Record from '@utils/datatypes/Record';

import { CSRFContext } from 'contexts/CSRFContext';

import { createCardDetails } from '../../../server/test/test-utils/data';
import UploadDeck from '../../src/records/UploadDeck';

const record: Record = {
  id: 'record-id',
  cube: 'cube-id',
  date: 0,
  name: 'A Record',
  description: '',
  players: [{ name: 'Alice' }],
  matches: [],
  trophy: [],
};

const GET_CARDS_URL = '/cube/api/getcardsforcube';

// Resolves every name the component asks for to a card of that name, except those listed in
// `unresolved`, which come back null the way the real endpoint reports a name it couldn't find.
const makeCsrfFetch = (unresolved: string[] = []) =>
  jest.fn(async (url: RequestInfo, init?: RequestInit) => {
    if (typeof url === 'string' && url.startsWith('/cube/api/cubecardpool/')) {
      return { ok: true, json: async () => ({ success: 'true', basics: [] }) } as Response;
    }
    if (url === GET_CARDS_URL) {
      const { names } = JSON.parse(`${init?.body}`) as { names: string[] };
      return {
        ok: true,
        json: async () => ({
          success: 'true',
          cards: names.map((name) =>
            unresolved.some((missing) => missing.toLowerCase() === name.toLowerCase())
              ? null
              : createCardDetails({ name }),
          ),
        }),
      } as Response;
    }
    return { ok: false, status: 404, json: async () => ({ success: 'false' }) } as Response;
  });

const renderUploadDeck = ({ csrfFetch = makeCsrfFetch(), showPlayerPicker = true } = {}) => {
  const setMainboardCards = jest.fn();
  const setSideboardCards = jest.fn();

  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <UploadDeck
        selectedUser={1}
        setSelectedUser={jest.fn()}
        showPlayerPicker={showPlayerPicker}
        record={record}
        mainboardCards={[]}
        setMainboardCards={setMainboardCards}
        sideboardCards={[]}
        setSideboardCards={setSideboardCards}
        setAlerts={jest.fn()}
        cubeId="cube-id"
      />
    </CSRFContext.Provider>,
  );

  return { csrfFetch, setMainboardCards, setSideboardCards };
};

// The component appends through a state updater, so replay the recorded updates against an empty
// board to get the names it actually added.
const addedNames = (setCards: jest.Mock): string[] =>
  setCards.mock.calls
    .reduce<CardDetails[]>(
      (cards, [update]) => (typeof update === 'function' ? update(cards) : (update as CardDetails[])),
      [],
    )
    .map((card) => card.name);

const paste = (text: string) => {
  fireEvent.change(screen.getByPlaceholderText(/Paste your decklist here/), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /Parse and Add/ }));
};

const textarea = () => screen.getByPlaceholderText(/Paste your decklist here/) as HTMLTextAreaElement;

const cardRequests = (csrfFetch: jest.Mock) => csrfFetch.mock.calls.filter(([url]) => url === GET_CARDS_URL);

describe('UploadDeck paste', () => {
  it('renders the paste textarea without clicking anything, and offers no way to hide it', () => {
    renderUploadDeck();

    expect(textarea()).toBeInTheDocument();
    // It used to live behind a Collapse, which hides with a CSS class rather than unmounting.
    expect(textarea().closest('.max-h-0')).toBeNull();
    expect(screen.queryByRole('button', { name: /Paste Decklist/ })).not.toBeInTheDocument();
  });

  // "Parse and Add to Mainboard" was a promise the parser does not keep: a list carrying its
  // own "Sideboard" line is split across both boards whatever the dropdown says, which is the
  // export format the sideboard handling exists for.
  it('does not claim the paste lands on the selected board', async () => {
    const { setMainboardCards, setSideboardCards } = renderUploadDeck();

    expect(screen.getByRole('button', { name: 'Parse and Add' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Parse and Add to/ })).not.toBeInTheDocument();

    // Selected board is the mainboard, and the marker still sends its section elsewhere.
    paste('Lightning Bolt\nSideboard\nPyroblast');
    await waitFor(() => expect(setSideboardCards).toHaveBeenCalled());
    expect(addedNames(setMainboardCards)).toEqual(['Lightning Bolt']);
    expect(addedNames(setSideboardCards)).toEqual(['Pyroblast']);
  });

  it('picks the board from a dropdown rather than a sideboard toggle', () => {
    renderUploadDeck();

    const board = screen.getByLabelText('Add to') as HTMLSelectElement;
    expect([...board.options].map((option) => option.label)).toEqual(['Mainboard', 'Sideboard']);
    expect(board).toHaveValue('mainboard');
    expect(screen.queryByLabelText('Add to Sideboard')).not.toBeInTheDocument();
  });

  // The transcription workspace renders one editor per player row, where whose deck this is
  // is the row it is in — a picker there is a second answer to a question already answered.
  it('hides the player picker when the caller says the player is implicit', () => {
    renderUploadDeck({ showPlayerPicker: false });

    expect(screen.queryByLabelText('Upload deck for player')).not.toBeInTheDocument();
    expect(textarea()).toBeInTheDocument();
  });

  it('keeps the player picker by default', () => {
    renderUploadDeck();

    expect(screen.getByLabelText('Upload deck for player')).toBeInTheDocument();
  });

  it('sends one request for a multi-line list, not one per line', async () => {
    const { csrfFetch, setMainboardCards } = renderUploadDeck();

    paste('Lightning Bolt\nCounterspell\nBirds of Paradise\nSol Ring');

    await waitFor(() => expect(setMainboardCards).toHaveBeenCalled());
    const requests = cardRequests(csrfFetch);
    expect(requests).toHaveLength(1);
    expect(JSON.parse(`${requests[0]![1].body}`).names).toEqual([
      'Lightning Bolt',
      'Counterspell',
      'Birds of Paradise',
      'Sol Ring',
    ]);
  });

  it('routes cards beneath a Sideboard marker to the sideboard', async () => {
    const { csrfFetch, setMainboardCards, setSideboardCards } = renderUploadDeck();

    paste('2 Lightning Bolt\nSideboard\nPyroblast\n1 Red Elemental Blast');

    await waitFor(() => expect(setSideboardCards).toHaveBeenCalled());
    expect(cardRequests(csrfFetch)).toHaveLength(1);
    expect(addedNames(setMainboardCards)).toEqual(['Lightning Bolt', 'Lightning Bolt']);
    expect(addedNames(setSideboardCards)).toEqual(['Pyroblast', 'Red Elemental Blast']);
  });

  // The dropdown belongs to the single-card field and the basics beside it. A paste routes
  // itself from its own section markers, and an unmarked list is a maindeck.
  it('ignores the board dropdown, which belongs to the field above it', async () => {
    const { setMainboardCards, setSideboardCards } = renderUploadDeck();

    fireEvent.change(screen.getByLabelText('Add to'), { target: { value: 'sideboard' } });
    paste('Pyroblast\nSurgical Extraction');

    await waitFor(() => expect(setMainboardCards).toHaveBeenCalled());
    expect(addedNames(setMainboardCards)).toEqual(['Pyroblast', 'Surgical Extraction']);
    expect(setSideboardCards).not.toHaveBeenCalled();
  });

  it('still routes a marked section while the dropdown says sideboard', async () => {
    const { setMainboardCards, setSideboardCards } = renderUploadDeck();

    fireEvent.change(screen.getByLabelText('Add to'), { target: { value: 'sideboard' } });
    paste('Lightning Bolt\nSideboard\nPyroblast');

    await waitFor(() => expect(setSideboardCards).toHaveBeenCalled());
    expect(addedNames(setMainboardCards)).toEqual(['Lightning Bolt']);
    expect(addedNames(setSideboardCards)).toEqual(['Pyroblast']);
  });

  it('expands a quantity into that many copies', async () => {
    const { csrfFetch, setMainboardCards } = renderUploadDeck();

    paste('3x Island\n2 Mountain');

    await waitFor(() => expect(setMainboardCards).toHaveBeenCalled());
    // One lookup per distinct line, not one per copy.
    expect(JSON.parse(`${cardRequests(csrfFetch)[0]![1].body}`).names).toEqual(['Island', 'Mountain']);
    expect(addedNames(setMainboardCards)).toEqual(['Island', 'Island', 'Island', 'Mountain', 'Mountain']);
  });

  it('lists unresolved lines and leaves them in the textarea', async () => {
    const { setMainboardCards } = renderUploadDeck({ csrfFetch: makeCsrfFetch(['Notacard']) });

    paste('Lightning Bolt\n2 Notacard\nCounterspell');

    await waitFor(() => expect(screen.getByText(/Could not find card/)).toBeInTheDocument());
    expect(screen.getByText('Could not find card: "2 Notacard"')).toBeInTheDocument();
    expect(addedNames(setMainboardCards)).toEqual(['Lightning Bolt', 'Counterspell']);
    expect(textarea()).toHaveValue('2 Notacard');
  });

  it('keeps each retained line on its own board when a partly-failed paste is retried', async () => {
    const { setMainboardCards, setSideboardCards } = renderUploadDeck({
      csrfFetch: makeCsrfFetch(['Notacard', 'Alsonotacard']),
    });

    paste('2 Lightning Bolt\nNotacard\nSideboard\nPyroblast\nAlsonotacard');

    await waitFor(() => expect(screen.getByText('Could not find card: "Notacard"')).toBeInTheDocument());
    expect(screen.getByText('Could not find card: "Alsonotacard"')).toBeInTheDocument();
    // The Sideboard marker has to come back with the text: without it the retry would silently
    // reroute Alsonotacard's replacement to the mainboard.
    await waitFor(() => expect(textarea()).toHaveValue('Notacard\nSideboard\nAlsonotacard'));

    // The user fixes the two typos, leaving the marker the component wrote back in place.
    paste(textarea().value.replace('Notacard', 'Counterspell').replace('Alsonotacard', 'Negate'));

    await waitFor(() => expect(textarea()).toHaveValue(''));
    expect(addedNames(setMainboardCards)).toEqual(['Lightning Bolt', 'Lightning Bolt', 'Counterspell']);
    expect(addedNames(setSideboardCards)).toEqual(['Pyroblast', 'Negate']);
    expect(screen.queryByText(/Could not find/)).not.toBeInTheDocument();
  });

  it('clears the textarea when every line resolves', async () => {
    const { setMainboardCards } = renderUploadDeck();

    paste('Lightning Bolt\nCounterspell');

    await waitFor(() => expect(setMainboardCards).toHaveBeenCalled());
    await waitFor(() => expect(textarea()).toHaveValue(''));
    expect(screen.queryByText(/Could not find card/)).not.toBeInTheDocument();
  });

  it('reports every line and keeps the text when nothing resolves', async () => {
    const { setMainboardCards, setSideboardCards } = renderUploadDeck({
      csrfFetch: makeCsrfFetch(['Nope', 'Also Nope']),
    });

    paste('Nope\nAlso Nope');

    await waitFor(() => expect(screen.getByText('Could not find card: "Nope"')).toBeInTheDocument());
    expect(screen.getByText('Could not find card: "Also Nope"')).toBeInTheDocument();
    expect(textarea()).toHaveValue('Nope\nAlso Nope');
    expect(setMainboardCards).not.toHaveBeenCalled();
    expect(setSideboardCards).not.toHaveBeenCalled();
  });

  it('ignores comment lines rather than reporting them as missing cards', async () => {
    const { csrfFetch, setMainboardCards } = renderUploadDeck();

    paste('// Creatures\nLightning Bolt\n// Lands\n2 Island');

    await waitFor(() => expect(setMainboardCards).toHaveBeenCalled());
    expect(JSON.parse(`${cardRequests(csrfFetch)[0]![1].body}`).names).toEqual(['Lightning Bolt', 'Island']);
    expect(addedNames(setMainboardCards)).toEqual(['Lightning Bolt', 'Island', 'Island']);
    expect(screen.queryByText(/Could not find/)).not.toBeInTheDocument();
    expect(textarea()).toHaveValue('');
  });

  it('warns and keeps the text when the paste holds no cards at all', async () => {
    const { csrfFetch } = renderUploadDeck();

    paste('// Creatures\nSideboard');

    await waitFor(() => expect(screen.getByText('Could not find any cards in the pasted text.')).toBeInTheDocument());
    expect(cardRequests(csrfFetch)).toHaveLength(0);
    expect(textarea()).toHaveValue('// Creatures\nSideboard');
  });
});
