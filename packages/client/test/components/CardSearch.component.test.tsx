import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import { defaultFilter } from '@utils/filtering/FilterCards';

import CardSearch from 'components/card/CardSearch';
import FilterContext, { FilterContextValue } from 'contexts/FilterContext';

jest.mock('components/Banner', () => () => <div />);
jest.mock('components/SideBanner', () => () => <div />);
jest.mock('components/DynamicFlash', () => () => <div />);
jest.mock('components/card/CardGrid', () => () => <div />);
jest.mock('components/modals/AdvancedFilterModal', () => () => <div />);
jest.mock('components/cubetray/useCubeTrayDrag', () => ({
  __esModule: true,
  default: () => ({ active: false }),
}));

const mockFetch = jest.fn();

const renderSearch = (query: string, filterInput: string | null = 'set:otj') => {
  window.history.replaceState({}, '', `/tool/searchcards?${query}`);

  const value: FilterContextValue = {
    filterInput,
    setFilterInput: jest.fn(),
    filterValid: true,
    cardFilter: { filter: defaultFilter() },
  };

  return render(
    <FilterContext.Provider value={value}>
      <CardSearch />
    </FilterContext.Provider>,
  );
};

const urlParam = (key: string): string | null => new URLSearchParams(window.location.search).get(key);

const lastDistinctParam = (): string | null => {
  const url: string = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0];
  return new URLSearchParams(url.split('?')[1]).get('di');
};

describe('CardSearch distinct option', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], numResults: 0 }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('defaults to Cards when no distinct is in the query', async () => {
    renderSearch('f=set%3Aotj');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    expect(screen.getAllByDisplayValue('Cards').length).toBeGreaterThan(0);
    expect(lastDistinctParam()).toEqual('names');
  });

  it('shows Printings when the query asks for printings', async () => {
    renderSearch('f=set%3Aotj&di=printings');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    expect(screen.getAllByDisplayValue('Printings').length).toBeGreaterThan(0);
    expect(lastDistinctParam()).toEqual('printings');
  });

  // The server treats any distinct other than "names" as printings, so the control has to
  // agree with it. Older links (notably the sets page) used the singular "printing", which
  // left the dropdown showing "Cards" while printings were displayed.
  it('shows Printings for the legacy singular "printing" value', async () => {
    renderSearch('f=set%3Aotj&di=printing');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    expect(screen.queryAllByDisplayValue('Cards')).toHaveLength(0);
    expect(screen.getAllByDisplayValue('Printings').length).toBeGreaterThan(0);
    expect(lastDistinctParam()).toEqual('printings');
  });

  it('normalizes the distinct query param it writes back to the url', async () => {
    renderSearch('f=set%3Aotj&di=printing');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    await waitFor(() => expect(new URLSearchParams(window.location.search).get('di')).toEqual('printings'));
  });
});

describe('CardSearch sort and direction options', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], numResults: 0 }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  const lastParam = (key: string): string | null => {
    const url: string = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0];
    return new URLSearchParams(url.split('?')[1]).get(key);
  };

  it('keeps recognized sort and direction values', async () => {
    renderSearch('f=set%3Aotj&s=Cube+Count&d=ascending');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    expect(screen.getAllByDisplayValue('Cube Count').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Ascending').length).toBeGreaterThan(0);
    expect(lastParam('s')).toEqual('Cube Count');
    expect(lastParam('d')).toEqual('ascending');
  });

  // The API only sorts when it recognizes the sort, so an unknown one would show results in
  // an arbitrary order while the dropdown displayed its first option.
  it('falls back to the default sort when the query asks for an unknown one', async () => {
    renderSearch('f=set%3Aotj&s=not+a+sort');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    expect(screen.getAllByDisplayValue('Elo').length).toBeGreaterThan(0);
    expect(lastParam('s')).toEqual('Elo');
  });

  // The API reverses only for "descending", so anything else has to read as ascending.
  it('treats an unrecognized direction as ascending, like the api does', async () => {
    renderSearch('f=set%3Aotj&d=Descending');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    expect(screen.getAllByDisplayValue('Ascending').length).toBeGreaterThan(0);
    expect(lastParam('d')).toEqual('ascending');
  });

  it('defaults to descending when no direction is given', async () => {
    renderSearch('f=set%3Aotj');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    expect(screen.getAllByDisplayValue('Descending').length).toBeGreaterThan(0);
    expect(lastParam('d')).toEqual('descending');
  });
});

describe('CardSearch query param binding', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], numResults: 0 }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('keeps the page from a shared link instead of resetting it on mount', async () => {
    renderSearch('f=set%3Aotj&p=2');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const url: string = mockFetch.mock.calls[0][0];
    expect(new URLSearchParams(url.split('?')[1]).get('p')).toEqual('2');
    expect(urlParam('p')).toEqual('2');
  });

  it('ignores a page that is not a positive number', async () => {
    renderSearch('f=set%3Aotj&p=-4');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const url: string = mockFetch.mock.calls[0][0];
    expect(new URLSearchParams(url.split('?')[1]).get('p')).toEqual('0');
  });

  // The api accepts ie=1, and its own csv link uses that form.
  it('accepts the api spelling of the include extras flag', async () => {
    renderSearch('f=set%3Aotj&ie=1');

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
    const url: string = mockFetch.mock.calls[0][0];
    expect(new URLSearchParams(url.split('?')[1]).get('ie')).toEqual('1');
  });

  it('drops params that are left at their default', async () => {
    renderSearch('f=set%3Aotj&s=Elo&d=descending&di=names&ie=false&v=cards&p=0');

    await waitFor(() => expect(urlParam('s')).toBeNull());

    expect(urlParam('d')).toBeNull();
    expect(urlParam('di')).toBeNull();
    expect(urlParam('ie')).toBeNull();
    expect(urlParam('v')).toBeNull();
    expect(urlParam('p')).toBeNull();
    expect(urlParam('f')).toEqual('set:otj');
  });

  // Card view with no filter never fetches, and the url used to be written only from inside
  // the fetch, so the chosen options were silently lost on reload.
  it('records option changes in the url even when nothing is searched', async () => {
    renderSearch('', null);

    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getAllByDisplayValue('Cards')[0], { target: { value: 'printings' } });

    await waitFor(() => expect(urlParam('di')).toEqual('printings'));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('CardSearch in-flight searches', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  const resolved = (numResults: number) => ({
    ok: true,
    json: async () => ({ data: [], numResults }),
  });

  it('does not let a superseded response overwrite the newest results', async () => {
    let releaseStale: (value: unknown) => void = () => {};
    const stale = new Promise((resolve) => {
      releaseStale = resolve;
    });

    mockFetch
      .mockResolvedValueOnce(resolved(1))
      .mockImplementationOnce(() => stale)
      .mockResolvedValueOnce(resolved(333));

    renderSearch('f=set%3Aotj');
    await waitFor(() => expect(screen.getByText('1 results')).toBeInTheDocument());

    fireEvent.change(screen.getAllByDisplayValue('Elo')[0], { target: { value: 'Alphabetical' } });
    fireEvent.change(screen.getAllByDisplayValue('Alphabetical')[0], { target: { value: 'Price' } });

    await waitFor(() => expect(screen.getByText('333 results')).toBeInTheDocument());

    await act(async () => {
      releaseStale(resolved(222));
      await Promise.resolve();
    });

    expect(screen.queryByText('222 results')).not.toBeInTheDocument();
    expect(screen.getByText('333 results')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Price').length).toBeGreaterThan(0);
    expect(urlParam('s')).toEqual('Price');
  });
});

describe('CardSearch cleared filter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('drops an in-flight response once the filter is cleared', async () => {
    let releasePending: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      releasePending = resolve;
    });
    mockFetch.mockImplementationOnce(() => pending);

    window.history.replaceState({}, '', '/tool/searchcards?f=set%3Aotj');

    const value: FilterContextValue = {
      filterInput: 'set:otj',
      setFilterInput: jest.fn(),
      filterValid: true,
      cardFilter: { filter: defaultFilter() },
    };

    const { rerender } = render(
      <FilterContext.Provider value={value}>
        <CardSearch />
      </FilterContext.Provider>,
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender(
      <FilterContext.Provider value={{ ...value, filterInput: '' }}>
        <CardSearch />
      </FilterContext.Provider>,
    );

    await act(async () => {
      releasePending({
        ok: true,
        json: async () => ({ data: [{ scryfall_id: 'abc', name: 'Stale Card' }], numResults: 42 }),
      });
      await Promise.resolve();
    });

    expect(screen.getByText('Enter a filter above to begin searching.')).toBeInTheDocument();
  });
});

describe('CardSearch history navigation', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], numResults: 0 }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  const lastParam = (key: string): string | null => {
    const url: string = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0];
    return new URLSearchParams(url.split('?')[1]).get(key);
  };

  const goBackTo = (query: string) => {
    window.history.replaceState({}, '', `/tool/searchcards?${query}`);
    fireEvent.popState(window);
  };

  it('restores the options from the url the browser navigated back to', async () => {
    renderSearch('f=set%3Aotj&s=Price&di=printings');

    await waitFor(() => expect(screen.getAllByDisplayValue('Price').length).toBeGreaterThan(0));

    goBackTo('f=set%3Aotj&d=ascending');

    await waitFor(() => expect(screen.getAllByDisplayValue('Elo').length).toBeGreaterThan(0));
    expect(screen.getAllByDisplayValue('Cards').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Ascending').length).toBeGreaterThan(0);
    await waitFor(() => expect(lastParam('s')).toEqual('Elo'));
    expect(lastParam('di')).toEqual('names');
    expect(lastParam('d')).toEqual('ascending');
  });

  it('keeps the page of the restored entry even though the filter changed with it', async () => {
    window.history.replaceState({}, '', '/tool/searchcards?f=set%3Aotj');

    const value: FilterContextValue = {
      filterInput: 'set:otj',
      setFilterInput: jest.fn(),
      filterValid: true,
      cardFilter: { filter: defaultFilter() },
    };

    const { rerender } = render(
      <FilterContext.Provider value={value}>
        <CardSearch />
      </FilterContext.Provider>,
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    act(() => {
      goBackTo('f=type%3Asnake&p=2');
      rerender(
        <FilterContext.Provider value={{ ...value, filterInput: 'type:snake' }}>
          <CardSearch />
        </FilterContext.Provider>,
      );
    });

    await waitFor(() => expect(lastParam('p')).toEqual('2'));
    expect(urlParam('p')).toEqual('2');
  });

  it('still resets the page for a filter change made after a restore', async () => {
    window.history.replaceState({}, '', '/tool/searchcards?f=set%3Aotj&p=2');

    const value: FilterContextValue = {
      filterInput: 'set:otj',
      setFilterInput: jest.fn(),
      filterValid: true,
      cardFilter: { filter: defaultFilter() },
    };

    const { rerender } = render(
      <FilterContext.Provider value={value}>
        <CardSearch />
      </FilterContext.Provider>,
    );

    await waitFor(() => expect(lastParam('p')).toEqual('2'));

    // A restore that changes nothing the page reset watches must not leave the guard armed.
    act(() => {
      goBackTo('f=set%3Aotj&p=2&s=Price');
    });

    await waitFor(() => expect(screen.getAllByDisplayValue('Price').length).toBeGreaterThan(0));

    rerender(
      <FilterContext.Provider value={{ ...value, filterInput: 'type:snake' }}>
        <CardSearch />
      </FilterContext.Provider>,
    );

    await waitFor(() => expect(lastParam('p')).toEqual('0'));
    expect(urlParam('p')).toBeNull();
  });

  // A restore that moves none of these options commits nothing, so nothing post-commit runs to
  // clear the guard. Recording the combination rather than a bare flag keeps that harmless: a
  // leftover entry can only match a commit that changed none of the options it names.
  it('still resets the page after a restore that commits nothing', async () => {
    window.history.replaceState({}, '', '/tool/searchcards?f=set%3Aotj&p=2');

    const value: FilterContextValue = {
      filterInput: 'set:otj',
      setFilterInput: jest.fn(),
      filterValid: true,
      cardFilter: { filter: defaultFilter() },
    };

    const { rerender } = render(
      <FilterContext.Provider value={value}>
        <CardSearch />
      </FilterContext.Provider>,
    );

    await waitFor(() => expect(lastParam('p')).toEqual('2'));

    act(() => {
      goBackTo('f=set%3Aotj&p=2');
    });

    rerender(
      <FilterContext.Provider value={{ ...value, filterInput: 'type:snake' }}>
        <CardSearch />
      </FilterContext.Provider>,
    );

    await waitFor(() => expect(lastParam('p')).toEqual('0'));
    expect(urlParam('p')).toBeNull();
  });
});

describe('CardSearch failed searches', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  // Without this the spinner is the only thing the user ever sees: the rejection escapes an
  // un-awaited call from the effect, so loading is never cleared.
  it('reports a rejected search instead of spinning forever', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    renderSearch('f=set%3Aotj');

    await waitFor(() => expect(screen.getByText('Search failed')).toBeInTheDocument());
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument();
  });

  // A non-ok response has no json body to parse, so reading one threw past the old guard.
  it('reports an error response rather than parsing its body', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => undefined });

    renderSearch('f=set%3Aotj');

    await waitFor(() => expect(screen.getByText('Search failed')).toBeInTheDocument());
  });

  it('recovers once a search succeeds again', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    const { rerender } = renderSearch('f=set%3Aotj');

    await waitFor(() => expect(screen.getByText('Search failed')).toBeInTheDocument());

    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [], numResults: 7 }) });

    rerender(
      <FilterContext.Provider
        value={{
          filterInput: 'type:snake',
          setFilterInput: jest.fn(),
          filterValid: true,
          cardFilter: { filter: defaultFilter() },
        }}
      >
        <CardSearch />
      </FilterContext.Provider>,
    );

    await waitFor(() => expect(screen.getByText('7 results')).toBeInTheDocument());
    expect(screen.queryByText('Search failed')).not.toBeInTheDocument();
  });
});
