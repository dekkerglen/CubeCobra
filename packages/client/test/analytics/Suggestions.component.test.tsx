import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import CardType, { CardDetails } from '@utils/datatypes/Card';

import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import FilterContext from 'contexts/FilterContext';

import Suggestions from '../../src/analytics/Suggestions';

// The filter bar, board picker, tray and add modal all pull in contexts and
// browser APIs that have nothing to do with paging, and the tray/modal would
// add buttons that the pager assertions index into.
jest.mock('components/FilterCollapse', () => ({
  __esModule: true,
  default: () => <div data-testid="filter-collapse" />,
}));

jest.mock('components/cube/AnalysisBoardPicker', () => ({
  __esModule: true,
  default: () => <div data-testid="board-picker" />,
}));

jest.mock('components/cubetray/CubeTray', () => ({
  __esModule: true,
  default: () => <div data-testid="cube-tray" />,
}));

jest.mock('components/modals/AddToCubeModal', () => ({
  __esModule: true,
  default: () => <div data-testid="add-to-cube-modal" />,
}));

jest.mock('components/card/CardGrid', () => ({
  __esModule: true,
  default: ({ cards }: { cards: CardType[] }) => (
    <div data-testid="card-grid">
      {cards.map((card) => (
        <div key={card.cardID}>{card.details?.name}</div>
      ))}
    </div>
  ),
}));

jest.mock('utils/cardDetailsCache', () => ({
  __esModule: true,
  getCardDetails: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getCardDetails } = jest.requireMock('utils/cardDetailsCache') as { getCardDetails: jest.Mock };

const PAGE_SIZE = 96;
const FETCH_LIMIT = PAGE_SIZE * 2;

const makeIds = (count: number, prefix = 'card'): string[] =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index}`);

const detailsFor = (id: string): CardDetails => ({ scryfall_id: id, name: id }) as unknown as CardDetails;

const addsResponse = (cardIDs: string[], totalAdds: number) => ({
  ok: true,
  status: 200,
  json: async () => ({ cardIDs, hasMoreAdds: false, totalAdds }),
});

const searchResponse = (data: CardDetails[], numResults: number) => ({
  ok: true,
  status: 200,
  json: async () => ({ data, numResults }),
});

const skipOf = (call: unknown[]): number => JSON.parse((call[1] as { body: string }).body).skip;

interface RenderOptions {
  csrfFetch: jest.Mock;
  filterInput?: string;
  emptyCube?: boolean;
}

const tree = ({ csrfFetch, filterInput = 'cmc:1', emptyCube = false }: RenderOptions) => (
  <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
    <CubeContext.Provider
      value={
        {
          cube: {
            id: 'cube-1',
            name: 'Test Cube',
            defaultPrinting: 'recent',
            cards: emptyCube ? { mainboard: [] } : { mainboard: [{ cardID: 'in-cube' }] },
          },
        } as any
      }
    >
      <FilterContext.Provider
        value={{ filterInput, setFilterInput: jest.fn(), filterValid: true, cardFilter: { filter: jest.fn() } } as any}
      >
        <Suggestions />
      </FilterContext.Provider>
    </CubeContext.Provider>
  </CSRFContext.Provider>
);

const renderSuggestions = (options: RenderOptions) => render(tree(options));

// Smart Search renders the same pager above and below the grid, so the label appears twice.
const findPageLabel = async (label: string) => (await screen.findAllByText(label))[0];

// [first, prev, next, last] for the top pager, then the same four for the bottom one.
const pagerButtons = () => screen.getAllByRole('button');
const clickNext = () => fireEvent.click(pagerButtons()[2]);
const clickLast = () => fireEvent.click(pagerButtons()[3]);

describe('Smart Search pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCardDetails.mockImplementation(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, detailsFor(id)])),
    );
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('renders a real denominator from the server total', async () => {
    // totalAdds 250, PAGE_SIZE 96 -> ceil(250/96) = 3
    const csrfFetch = jest.fn().mockResolvedValue(addsResponse(makeIds(FETCH_LIMIT), 250));

    renderSuggestions({ csrfFetch });

    expect(await findPageLabel('Page 1 of 3')).toBeInTheDocument();
  });

  it('renders Page 1 of 1 when everything fits one page', async () => {
    // totalAdds 50 -> pageCount 1. Matches card search, which shows this today.
    const csrfFetch = jest.fn().mockResolvedValue(addsResponse(makeIds(50), 50));

    renderSuggestions({ csrfFetch });

    expect(await findPageLabel('Page 1 of 1')).toBeInTheDocument();
  });

  it('jumps to the last page in a single request', async () => {
    // totalAdds 960 -> 10 pages; page 9 lives in window 4.
    const csrfFetch = jest.fn().mockImplementation(async (_url: string, options: { body: string }) => {
      const { skip } = JSON.parse(options.body);
      return addsResponse(makeIds(FETCH_LIMIT, `w${skip / FETCH_LIMIT}`), 960);
    });

    renderSuggestions({ csrfFetch });
    expect(await findPageLabel('Page 1 of 10')).toBeInTheDocument();

    clickLast();

    expect(await findPageLabel('Page 10 of 10')).toBeInTheDocument();
    expect(csrfFetch).toHaveBeenCalledTimes(2);
    expect(skipOf(csrfFetch.mock.calls[1])).toBe(4 * FETCH_LIMIT);
  });

  it('serves the second page from the same window without refetching', async () => {
    const csrfFetch = jest.fn().mockResolvedValue(addsResponse(makeIds(FETCH_LIMIT), 250));

    renderSuggestions({ csrfFetch });
    expect(await findPageLabel('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('card-0')).toBeInTheDocument();

    clickNext();

    expect(await findPageLabel('Page 2 of 3')).toBeInTheDocument();
    // The second half of the same window, already in hand.
    expect(screen.getByText(`card-${PAGE_SIZE}`)).toBeInTheDocument();
    expect(csrfFetch).toHaveBeenCalledTimes(1);
  });

  // Review Focus 3
  it('does not show the previous search results after the filter changes', async () => {
    const csrfFetch = jest.fn().mockImplementation(async (_url: string, options: { body: string }) => {
      const { filterText } = JSON.parse(options.body);
      return addsResponse([filterText === 'cmc:1' ? 'Card A' : 'Card B'], 1);
    });

    const { rerender } = renderSuggestions({ csrfFetch });
    expect(await screen.findByText('Card A')).toBeInTheDocument();

    rerender(tree({ csrfFetch, filterInput: 'cmc:2' }));

    expect(await screen.findByText('Card B')).toBeInTheDocument();
    expect(screen.queryByText('Card A')).not.toBeInTheDocument();
  });

  // Review Focus 2
  it('clamps to the last valid page when the total shrinks', async () => {
    const csrfFetch = jest.fn().mockImplementation(async (_url: string, options: { body: string }) => {
      const { skip } = JSON.parse(options.body);
      // The first window still sees the large list; everything after it sees a shrunken one.
      const total = skip === 0 ? 960 : 200;
      return addsResponse(makeIds(FETCH_LIMIT, `w${skip / FETCH_LIMIT}`), total);
    });

    renderSuggestions({ csrfFetch });
    expect(await findPageLabel('Page 1 of 10')).toBeInTheDocument();

    clickLast();

    // 200 results is 3 pages, so page 10 no longer exists — the last one does.
    expect(await findPageLabel('Page 3 of 3')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('card-grid').childElementCount).toBeGreaterThan(0));
  });

  // Review Focus 4
  it('keeps the denominator correct when some ids fail to resolve', async () => {
    const csrfFetch = jest.fn().mockResolvedValue(addsResponse(makeIds(FETCH_LIMIT), 250));
    getCardDetails.mockImplementation(async (ids: string[]) =>
      Object.fromEntries(ids.slice(0, ids.length - 2).map((id) => [id, detailsFor(id)])),
    );

    renderSuggestions({ csrfFetch });

    // From totalAdds, not from the 190 cards that resolved.
    expect(await findPageLabel('Page 1 of 3')).toBeInTheDocument();
  });

  // Clamping alone would leave windows cached against the old list in place, so a page
  // from one of them would render results the current total no longer describes.
  it('does not serve a cached window fetched under a different total', async () => {
    let shrunk = false;
    const csrfFetch = jest.fn().mockImplementation(async (_url: string, options: { body: string }) => {
      const { skip } = JSON.parse(options.body);
      // The list shrinks as soon as the user leaves the first window.
      if (skip > 0) shrunk = true;
      const total = shrunk ? 200 : 960;
      return addsResponse(makeIds(FETCH_LIMIT, `w${skip / FETCH_LIMIT}`), total);
    });

    renderSuggestions({ csrfFetch });
    expect(await findPageLabel('Page 1 of 10')).toBeInTheDocument();

    clickLast();
    expect(await findPageLabel('Page 3 of 3')).toBeInTheDocument();

    fireEvent.click(pagerButtons()[0]);

    expect(await findPageLabel('Page 1 of 3')).toBeInTheDocument();
    expect(csrfFetch).toHaveBeenCalledTimes(4);
    expect(skipOf(csrfFetch.mock.calls[3])).toBe(0);
  });

  // Review Focus 5
  it('still shows the recommender-unavailable message', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ mlUnavailable: true, cardIDs: [], hasMoreAdds: false, totalAdds: 0 }),
    });

    renderSuggestions({ csrfFetch });

    expect(await screen.findByText(/recommender is temporarily unavailable/)).toBeInTheDocument();
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
    expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument();
  });

  it('still shows the generic failure message', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ cardIDs: [], hasMoreAdds: false, totalAdds: 0 }),
    });

    renderSuggestions({ csrfFetch });

    expect(await screen.findByText(/couldn't fetch Smart Search results/)).toBeInTheDocument();
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
    expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument();
  });

  it('counts pages from numResults on an empty cube', async () => {
    const csrfFetch = jest.fn();
    global.fetch = jest
      .fn()
      .mockResolvedValue(searchResponse(makeIds(PAGE_SIZE).map(detailsFor), 200)) as unknown as typeof fetch;

    renderSuggestions({ csrfFetch, emptyCube: true });

    expect(await findPageLabel('Page 1 of 3')).toBeInTheDocument();
    expect(csrfFetch).not.toHaveBeenCalled();
  });
});
