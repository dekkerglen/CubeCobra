import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import CardPackageData from '@utils/datatypes/CardPackage';

import { CSRFContext } from 'contexts/CSRFContext';

import PackagesPage from '../../src/pages/PackagesPage';

jest.mock('components/Banner', () => () => <div />);
jest.mock('components/SideBanner', () => () => <div />);
jest.mock('components/DynamicFlash', () => () => <div />);
jest.mock('components/modals/PackageSearchSyntaxModal', () => () => <div />);
jest.mock('components/card/CardPackage', () => ({ cardPackage }: { cardPackage: CardPackageData }) => (
  <div>{cardPackage.title}</div>
));
// RenderToRoot returns the component untouched, but it also pulls in the global stylesheets,
// which jest has no transform for.
jest.mock('components/RenderToRoot', () => ({
  __esModule: true,
  default: (component: unknown) => component,
}));

const PAGE_SIZE = 36;

const mockCsrfFetch = jest.fn();

const makePackage = (title: string): CardPackageData => ({ id: title, title }) as CardPackageData;

const makePackages = (prefix: string, count: number): CardPackageData[] =>
  Array.from({ length: count }, (_, index) => makePackage(`${prefix} ${index}`));

const renderPackages = (
  query: string,
  items: CardPackageData[] = [makePackage('Seeded Package')],
  lastKey: string | null = null,
) => {
  window.history.replaceState({}, '', `/packages?${query}`);

  return render(
    <CSRFContext.Provider
      value={
        {
          csrfToken: 'token',
          csrfFetch: mockCsrfFetch,
          // Mirrors the real provider, where callApi is csrfFetch with a JSON POST body, so both of
          // the page's request paths stay observable through the single csrfFetch mock.
          callApi: (route: RequestInfo, body: any) =>
            mockCsrfFetch(route, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }),
        } as any
      }
    >
      <PackagesPage items={items} lastKey={lastKey} parsedQuery={[]} />
    </CSRFContext.Provider>,
  );
};

const resolvedPage = (packages: CardPackageData[], lastKey: string | null) => ({
  ok: true,
  json: async () => ({ packages, lastKey, parsedQuery: [] }),
});

const lastBody = () => JSON.parse(mockCsrfFetch.mock.calls[mockCsrfFetch.mock.calls.length - 1][1].body);

describe('PackagesPage result reporting', () => {
  beforeEach(() => {
    mockCsrfFetch.mockReset();
    mockCsrfFetch.mockResolvedValue(resolvedPage([], null));
  });

  // The old line counted the records this browser session happened to have scrolled through,
  // which says nothing about how many packages match the query.
  it('renders no package count line when there are results', () => {
    renderPackages('q=demo', makePackages('pack', 3), 'key-1');

    expect(screen.queryByText(/packages found/)).not.toBeInTheDocument();
    expect(screen.queryByText(/found/)).not.toBeInTheDocument();
  });

  it('still renders No Results when empty', () => {
    renderPackages('q=demo', []);

    expect(screen.getByText('No Results')).toBeInTheDocument();
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('labels the loaded page without a denominator', () => {
    renderPackages('q=demo', makePackages('pack', 3), 'key-1');

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(screen.queryByText(/of \d/)).not.toBeInTheDocument();
  });

  // The strip the count line used to occupy is padded chrome. With nothing left in it, a single
  // page of results would end up with an empty band above the list.
  it('renders no empty padded band above a single page of results', () => {
    const { container } = renderPackages('q=demo', makePackages('pack', 3));

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(container.querySelector('.pt-3.pb-3')).toBeNull();
  });

  it('still renders that band when a pager goes in it', () => {
    const { container } = renderPackages('q=demo', makePackages('pack', 3), 'key-1');

    expect(container.querySelector('.pt-3.pb-3')).not.toBeNull();
  });

  it('keeps the searching state while a search is in flight', async () => {
    mockCsrfFetch.mockImplementation(() => new Promise(() => {}));

    renderPackages('q=demo');
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => expect(screen.getByText('Searching…')).toBeInTheDocument());
  });
});

describe('PackagesPage paging forward', () => {
  beforeEach(() => {
    mockCsrfFetch.mockReset();
  });

  it('sends the cursor alongside the active search params', async () => {
    mockCsrfFetch.mockResolvedValue(resolvedPage(makePackages('next', PAGE_SIZE), null));

    renderPackages('q=demo&s=date&a=true', makePackages('first', PAGE_SIZE), 'key-1');

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText('Next page')[0]);
    });

    expect(mockCsrfFetch).toHaveBeenCalledTimes(1);
    // The cursor has to survive the merge with the search params; a body that overwrote it would
    // silently re-request page one forever.
    expect(lastBody()).toEqual({ query: 'demo', sort: 'date', ascending: 'true', lastKey: 'key-1' });
    expect(screen.getAllByText('Page 2').length).toBeGreaterThan(0);
    expect(screen.getByText('next 0')).toBeInTheDocument();
  });

  it('renders no pager for a single page with nothing after it', () => {
    renderPackages('q=demo', makePackages('pack', 3), null);

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
  });
});
