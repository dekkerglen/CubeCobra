import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import { CSRFContext } from 'contexts/CSRFContext';

import SearchPage from '../../src/pages/SearchPage';

jest.mock('components/Banner', () => () => <div />);
jest.mock('components/SideBanner', () => () => <div />);
jest.mock('components/DynamicFlash', () => () => <div />);
jest.mock('components/cube/CubePreview', () => ({ cube }: { cube: Cube }) => <div>{cube.name}</div>);
jest.mock('components/modals/SearchSyntaxModal', () => () => <div />);
// RenderToRoot returns the component untouched, but it also pulls in the global stylesheets,
// which jest has no transform for.
jest.mock('components/RenderToRoot', () => ({
  __esModule: true,
  default: (component: unknown) => component,
}));

const mockCsrfFetch = jest.fn();

const PAGE_SIZE = 36;

const makeCube = (name: string): Cube => ({ id: name, name }) as Cube;

const makeCubes = (prefix: string, count: number): Cube[] =>
  Array.from({ length: count }, (_, index) => makeCube(`${prefix} ${index}`));

const renderSearch = (query: string, cubes: Cube[] = [makeCube('Seeded Cube')], lastKey?: string) => {
  window.history.replaceState({}, '', `/search?${query}`);

  return render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch: mockCsrfFetch } as any}>
      <SearchPage cubes={cubes} lastKey={lastKey} parsedQuery={[]} />
    </CSRFContext.Provider>,
  );
};

const resolved = (cubes: Cube[]) => ({
  ok: true,
  json: async () => ({ success: 'true', cubes, lastKey: null, parsedQuery: [] }),
});

const resolvedPage = (cubes: Cube[], lastKey: string | null) => ({
  ok: true,
  json: async () => ({ success: 'true', cubes, lastKey, parsedQuery: [] }),
});

const lastBody = () => JSON.parse(mockCsrfFetch.mock.calls[mockCsrfFetch.mock.calls.length - 1][1].body);

const submitSearch = () => {
  const box = screen.getByPlaceholderText('Search cubes...');
  fireEvent.submit(box.closest('form')!);
};

describe('SearchPage option binding', () => {
  beforeEach(() => {
    mockCsrfFetch.mockReset();
    mockCsrfFetch.mockResolvedValue(resolved([]));
  });

  it('shows the direction the server will actually use', async () => {
    // Only the exact string "true" counts as ascending, so this has to read as descending.
    renderSearch('order=alpha&ascending=1');

    expect(screen.getByDisplayValue('Descending')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sorted Alphabetically')).toBeInTheDocument();
  });

  it('falls back to the default order for an unknown one', async () => {
    renderSearch('order=bogus&ascending=true');

    expect(screen.getByDisplayValue('Sorted by Popularity')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ascending')).toBeInTheDocument();
  });

  it('posts the clamped values rather than the raw query params', async () => {
    renderSearch('q=demo&order=bogus&ascending=1');

    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(mockCsrfFetch).toHaveBeenCalled());
    expect(lastBody()).toEqual({ query: 'demo', order: 'pop', ascending: 'false', lastKey: null });
  });

  it('keeps the query in the url after a search', async () => {
    renderSearch('q=demo');

    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(mockCsrfFetch).toHaveBeenCalled());
    expect(new URLSearchParams(window.location.search).get('q')).toEqual('demo');
  });

  // Writing the three params one at a time pushed an entry each, so the url in between
  // described a search that never ran — and Back, which re-runs the url it lands on, ran it.
  it('pushes a single history entry for a search that changes several params', async () => {
    renderSearch('q=demo&order=date');
    const entriesBefore = window.history.length;

    fireEvent.change(screen.getByPlaceholderText('Search cubes...'), { target: { value: 'snake' } });
    fireEvent.change(screen.getByDisplayValue('Sorted by Last Updated'), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(mockCsrfFetch).toHaveBeenCalled());
    expect(window.history.length).toEqual(entriesBefore + 1);
    expect(window.location.search).toEqual('?q=snake&order=alpha');
  });

  it('adds no history entry for a search that changes nothing', async () => {
    renderSearch('q=demo');
    const entriesBefore = window.history.length;

    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(mockCsrfFetch).toHaveBeenCalled());
    expect(window.history.length).toEqual(entriesBefore);
  });

  it('drops params left at their default rather than spelling them out', async () => {
    renderSearch('q=demo&order=alpha&ascending=true');

    fireEvent.change(screen.getByDisplayValue('Sorted Alphabetically'), { target: { value: 'pop' } });
    fireEvent.change(screen.getByDisplayValue('Ascending'), { target: { value: 'false' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(mockCsrfFetch).toHaveBeenCalled());
    expect(window.location.search).toEqual('?q=demo');
  });
});

describe('SearchPage failed searches', () => {
  beforeEach(() => {
    mockCsrfFetch.mockReset();
  });

  // Without this the spinner is the only thing the user ever sees: the rejection escapes an
  // un-awaited call, so loading is never cleared and nothing says the search failed.
  it('reports a rejected search instead of spinning forever', async () => {
    mockCsrfFetch.mockRejectedValue(new Error('network down'));

    renderSearch('q=demo');
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Search failed')).toBeInTheDocument());
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument();
  });

  it('reports an error response the same way', async () => {
    mockCsrfFetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    renderSearch('q=demo');
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Search failed')).toBeInTheDocument());
  });

  it('recovers on the next successful search', async () => {
    mockCsrfFetch.mockRejectedValueOnce(new Error('network down'));

    renderSearch('q=demo');
    fireEvent.click(screen.getByText('Search'));
    await waitFor(() => expect(screen.getByText('Search failed')).toBeInTheDocument());

    mockCsrfFetch.mockResolvedValue(resolved([makeCube('Recovered Cube')]));
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Recovered Cube')).toBeInTheDocument());
    expect(screen.queryByText('Search failed')).not.toBeInTheDocument();
  });
});

describe('SearchPage history navigation', () => {
  beforeEach(() => {
    mockCsrfFetch.mockReset();
    mockCsrfFetch.mockResolvedValue(resolved([]));
  });

  it('re-runs the search for the url the browser navigated back to', async () => {
    renderSearch('q=current&order=alpha&ascending=true');

    await act(async () => {
      window.history.replaceState({}, '', '/search?q=restored&order=date&ascending=false');
      fireEvent.popState(window);
    });

    await waitFor(() => expect(mockCsrfFetch).toHaveBeenCalled());
    expect(lastBody()).toEqual({ query: 'restored', order: 'date', ascending: 'false', lastKey: null });
    await waitFor(() => expect(screen.getByDisplayValue('Sorted by Last Updated')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Descending')).toBeInTheDocument();
  });
});

describe('SearchPage in-flight searches', () => {
  beforeEach(() => {
    mockCsrfFetch.mockReset();
  });

  it('does not let a superseded search overwrite the newest results', async () => {
    let releaseStale: (value: unknown) => void = () => {};
    const stale = new Promise((resolve) => {
      releaseStale = resolve;
    });

    mockCsrfFetch.mockImplementationOnce(() => stale).mockResolvedValueOnce(resolved([makeCube('Newest Cube')]));

    renderSearch('q=demo');

    // The Search button disables itself while in flight, so a second search in that window
    // comes from the text box.
    submitSearch();
    submitSearch();

    await waitFor(() => expect(screen.getByText('Newest Cube')).toBeInTheDocument());

    await act(async () => {
      releaseStale(resolved([makeCube('Stale Cube')]));
      await Promise.resolve();
    });

    expect(screen.queryByText('Stale Cube')).not.toBeInTheDocument();
    expect(screen.getByText('Newest Cube')).toBeInTheDocument();
  });
});

describe('SearchPage submit paths', () => {
  beforeEach(() => {
    mockCsrfFetch.mockReset();
    mockCsrfFetch.mockResolvedValue(resolved([]));
  });

  // The form's hidden submit button already handles Enter, so an onEnter on the input would
  // run the same search twice.
  it('runs a single search per submit', async () => {
    renderSearch('q=demo');

    // jsdom doesn't implicitly submit a form on Enter, so a browser's Enter is both of these:
    // the input's own key handling, and the form submit it triggers.
    const box = screen.getByPlaceholderText('Search cubes...');
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.submit(box.closest('form')!);

    await waitFor(() => expect(mockCsrfFetch).toHaveBeenCalled());
    expect(mockCsrfFetch).toHaveBeenCalledTimes(1);
  });

  it('runs a single search when the button is clicked', async () => {
    renderSearch('q=demo');

    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(mockCsrfFetch).toHaveBeenCalled());
    expect(mockCsrfFetch).toHaveBeenCalledTimes(1);
  });
});

describe('SearchPage clear button', () => {
  beforeEach(() => {
    mockCsrfFetch.mockReset();
    mockCsrfFetch.mockResolvedValue(resolved([]));
  });

  it('clears the query text without re-running the search or rewriting the url', () => {
    renderSearch('q=demo');

    const urlBefore = window.location.search;

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByPlaceholderText('Search cubes...')).toHaveValue('');
    expect(mockCsrfFetch).not.toHaveBeenCalled();
    expect(window.location.search).toEqual(urlBefore);
  });
});

describe('SearchPage result reporting', () => {
  beforeEach(() => {
    mockCsrfFetch.mockReset();
    mockCsrfFetch.mockResolvedValue(resolved([]));
  });

  // The old line counted the records this browser session happened to have scrolled through,
  // which says nothing about how many cubes match the query.
  it('renders no cube count line when there are results', () => {
    renderSearch('q=demo', makeCubes('cube', 3), 'key-1');

    expect(screen.queryByText(/cubes found/)).not.toBeInTheDocument();
    expect(screen.queryByText(/found/)).not.toBeInTheDocument();
  });

  it('still renders No Results when empty', () => {
    renderSearch('q=demo', []);

    expect(screen.getByText('No Results')).toBeInTheDocument();
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('labels the loaded page without a denominator', () => {
    renderSearch('q=demo', makeCubes('cube', 3), 'key-1');

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(screen.queryByText(/of \d/)).not.toBeInTheDocument();
  });

  // The strip the count line used to occupy is padded chrome. With nothing left in it, a single
  // page of results would end up with an empty band above the grid.
  it('renders no empty padded band above a single page of results', () => {
    const { container } = renderSearch('q=demo', makeCubes('cube', 3));

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(container.querySelector('.pt-3.pb-3')).toBeNull();
  });

  it('still renders that band when a pager goes in it', () => {
    const { container } = renderSearch('q=demo', makeCubes('cube', 3), 'key-1');

    expect(container.querySelector('.pt-3.pb-3')).not.toBeNull();
  });

  it('keeps the searching state while a search is in flight', async () => {
    mockCsrfFetch.mockImplementation(() => new Promise(() => {}));

    renderSearch('q=demo');
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Searching…')).toBeInTheDocument());
  });
});

describe('SearchPage paging forward', () => {
  beforeEach(() => {
    mockCsrfFetch.mockReset();
  });

  it('sends the cursor alongside the active search params', async () => {
    mockCsrfFetch.mockResolvedValue(resolvedPage(makeCubes('next', PAGE_SIZE), null));

    renderSearch('q=demo&order=alpha&ascending=true', makeCubes('first', PAGE_SIZE), 'key-1');

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText('Next page')[0]);
    });

    expect(mockCsrfFetch).toHaveBeenCalledTimes(1);
    // The cursor has to survive the merge with the search params; a body that overwrote it would
    // silently re-request page one forever.
    expect(lastBody()).toEqual({ query: 'demo', order: 'alpha', ascending: 'true', lastKey: 'key-1' });
    expect(screen.getAllByText('Page 2').length).toBeGreaterThan(0);
    expect(screen.getByText('next 0')).toBeInTheDocument();
  });

  // The page fetch runs through the shared helper, which knows nothing about request ordering, so
  // the stale guard has to live in the setters the page hands it.
  it('does not let a superseded page fetch overwrite a newer search', async () => {
    let releaseStale: (value: unknown) => void = () => {};
    const stale = new Promise((resolve) => {
      releaseStale = resolve;
    });

    mockCsrfFetch
      .mockImplementationOnce(() => stale)
      .mockResolvedValueOnce(resolvedPage([makeCube('Newest Cube')], null));

    renderSearch('q=demo', makeCubes('first', PAGE_SIZE), 'key-1');

    fireEvent.click(screen.getAllByLabelText('Next page')[0]);
    submitSearch();

    await waitFor(() => expect(screen.getByText('Newest Cube')).toBeInTheDocument());

    await act(async () => {
      releaseStale(resolvedPage([makeCube('Stale Cube')], 'key-2'));
      await Promise.resolve();
    });

    expect(screen.queryByText('Stale Cube')).not.toBeInTheDocument();
    expect(screen.queryByText('first 0')).not.toBeInTheDocument();
    expect(screen.getByText('Newest Cube')).toBeInTheDocument();
  });

  it('reports a failed page fetch instead of silently doing nothing', async () => {
    mockCsrfFetch.mockRejectedValue(new Error('network down'));

    renderSearch('q=demo', makeCubes('first', PAGE_SIZE), 'key-1');

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText('Next page')[0]);
    });

    expect(screen.getByText('Search failed')).toBeInTheDocument();
    expect(screen.getByText('first 0')).toBeInTheDocument();
  });
});
