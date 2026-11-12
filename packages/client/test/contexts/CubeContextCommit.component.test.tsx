import React, { useContext } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import { ChangesContextProvider } from 'contexts/ChangesContext';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext, { CubeContextProvider } from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import { FilterContextProvider } from 'contexts/FilterContext';

jest.mock('utils/cardDetailsCache', () => ({
  getCardDetail: jest.fn(),
  getCardDetails: jest.fn(async () => ({})),
}));

const SORTS = ['Color Category', 'Types-Multicolor', 'Mana Value', 'Alphabetical'];

const cube = {
  id: 'c1',
  shortId: 'c1',
  name: 'Test Cube',
  version: 3,
  cardCount: 1,
  defaultSorts: SORTS,
  views: [{ name: 'Mainboard', boards: ['mainboard'], displayView: 'table', defaultSorts: SORTS }],
} as unknown as Cube;

const details = { scryfall_id: 'a', oracle_id: 'oa', name: 'Card A', oracle_text: 'Long oracle text' };
const cards = () => ({
  mainboard: [{ cardID: 'a', index: 0, board: 'mainboard', details }],
  maybeboard: [],
});

const CHANGES_KEY = 'cubecobra-changes-c1';
const pendingChanges = {
  version: 3,
  mainboard: { removes: [{ index: 0, oldCard: { cardID: 'a', index: 0, board: 'mainboard', details } }] },
};

const CommitButton: React.FC = () => {
  const { commitChanges, alerts, cube: contextCube } = useContext(CubeContext);
  const [result, setResult] = React.useState<string>('none');
  return (
    <>
      <button onClick={async () => setResult(String(await commitChanges('title', 'blog')))}>commit</button>
      <span data-testid="result">{result}</span>
      <span data-testid="card-count">{contextCube.cardCount}</span>
      {alerts.map((alert, i) => (
        <span key={i} data-testid={`alert-${alert.color}`}>
          {alert.message}
        </span>
      ))}
    </>
  );
};

const csrfFetch = jest.fn();

const renderAndCommit = async (initialCube: Cube = cube, initialCards: ReturnType<typeof cards> = cards()) => {
  window.history.replaceState({}, '', '/cube/list/c1');
  render(
    <CSRFContext.Provider value={{ csrfFetch, callApi: jest.fn() } as any}>
      <DisplayContextProvider cubeID="c1" viewSlugs={['mainboard']}>
        <FilterContextProvider>
          <ChangesContextProvider cube={initialCube} cards={initialCards as any}>
            <CubeContextProvider initialCube={initialCube} cards={initialCards as any}>
              <CommitButton />
            </CubeContextProvider>
          </ChangesContextProvider>
        </FilterContextProvider>
      </DisplayContextProvider>
    </CSRFContext.Provider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByText('commit'));
  });
};

const storedChanges = () => JSON.parse(localStorage.getItem(CHANGES_KEY) ?? '{}');

describe('CubeContext commitChanges', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CHANGES_KEY, JSON.stringify(pendingChanges));
    csrfFetch.mockReset();
  });

  it('sends removes without card details', async () => {
    csrfFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: 'true', updateApplied: true, version: 4 }),
    });
    await renderAndCommit();

    const sent = JSON.parse(csrfFetch.mock.calls[0][1].body);
    expect(sent.changes.mainboard.removes[0].oldCard).toEqual({ cardID: 'a', index: 0, board: 'mainboard' });
  });

  it('clears the changes and reports success when the commit lands', async () => {
    csrfFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: 'true', updateApplied: true, version: 4 }),
    });
    await renderAndCommit();

    expect(screen.getByTestId('result')).toHaveTextContent('true');
    expect(storedChanges()).toEqual({});
  });

  // The spam gate on the overview, primer, and blog editors reads cube.cardCount. A brand new cube
  // starts at zero, so if the commit doesn't refresh it the gate stays shut until a page reload.
  it('updates the card count when the first card is added to an empty cube', async () => {
    const emptyCube = { ...cube, cardCount: 0 } as Cube;
    localStorage.setItem(
      CHANGES_KEY,
      JSON.stringify({ version: 3, mainboard: { adds: [{ cardID: 'b', addedTmsp: 0 }] } }),
    );
    csrfFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: 'true', updateApplied: true, version: 4 }),
    });
    await renderAndCommit(emptyCube, { mainboard: [], maybeboard: [] });

    expect(screen.getByTestId('result')).toHaveTextContent('true');
    expect(screen.getByTestId('card-count')).toHaveTextContent('1');
  });

  it('updates the card count when cards are removed', async () => {
    csrfFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: 'true', updateApplied: true, version: 4 }),
    });
    await renderAndCommit();

    expect(screen.getByTestId('card-count')).toHaveTextContent('0');
  });

  it('treats a commit whose blog post failed as saved', async () => {
    csrfFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: 'false', updateApplied: true, version: 4, message: 'blog failed' }),
    });
    await renderAndCommit();

    expect(screen.getByTestId('result')).toHaveTextContent('true');
    expect(screen.getByTestId('alert-warning')).toHaveTextContent('blog failed');
    expect(storedChanges()).toEqual({});
  });

  it.each([
    [
      'the proxy rejects the body as too large',
      () =>
        csrfFetch.mockResolvedValue({
          ok: false,
          status: 413,
          json: async () => {
            throw new SyntaxError('Unexpected token <');
          },
        }),
      'Too many changes to save at once.',
    ],
    [
      'the request times out',
      () => csrfFetch.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError')),
      'Operation timed out',
    ],
    [
      'the request fails on the network',
      () => csrfFetch.mockRejectedValue(new TypeError('Failed to fetch')),
      'Failed to save changes. Please try again.',
    ],
    [
      'a gateway returns an HTML error page',
      () =>
        csrfFetch.mockResolvedValue({
          ok: false,
          status: 502,
          json: async () => {
            throw new SyntaxError('Unexpected token <');
          },
        }),
      'Failed to save changes. Please try again.',
    ],
    [
      'the server rejects the changes',
      () =>
        csrfFetch.mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({ success: 'false', message: 'This cube was updated since you started editing.' }),
        }),
      'This cube was updated since you started editing.',
    ],
  ])('keeps the changes and reports failure when %s', async (_label, mock, message) => {
    mock();
    await renderAndCommit();

    expect(screen.getByTestId('result')).toHaveTextContent('false');
    expect(screen.getByTestId('alert-danger')).toHaveTextContent(message);
    expect(storedChanges().mainboard.removes).toHaveLength(1);
  });
});
