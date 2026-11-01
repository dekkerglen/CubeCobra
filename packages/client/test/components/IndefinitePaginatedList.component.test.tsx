import React, { useState } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import IndefinitePaginatedList from 'components/IndefinitePaginatedList';
import { CSRFContext } from 'contexts/CSRFContext';

interface Item {
  name: string;
}

const makeItems = (count: number, offset = 0): Item[] =>
  Array.from({ length: count }, (_, index) => ({ name: `Item ${index + 1 + offset}` }));

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

interface HarnessOptions {
  initialItems?: Item[];
  initialLastKey?: any;
  callApi?: jest.Mock;
  pageSize?: number;
  inCard?: boolean;
  countRows?: (items: Item[]) => number;
}

const renderList = ({
  initialItems = [],
  initialLastKey = null,
  callApi = jest.fn(),
  pageSize = 5,
  inCard = false,
  countRows,
}: HarnessOptions = {}) => {
  const Harness: React.FC = () => {
    const [items, setItems] = useState<Item[]>(initialItems);
    const [lastKey, setLastKey] = useState<any>(initialLastKey);

    return (
      <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch: jest.fn(), callApi } as any}>
        <IndefinitePaginatedList<Item>
          items={items}
          setItems={setItems}
          lastKey={lastKey}
          setLastKey={setLastKey}
          fetchMoreRoute="/more"
          renderItem={(item) => <div>{item.name}</div>}
          pageSize={pageSize}
          header="Blog Posts"
          inCard={inCard}
          countRows={countRows}
        />
      </CSRFContext.Provider>
    );
  };

  return render(<Harness />);
};

describe('IndefinitePaginatedList', () => {
  it('shows no pager and no count when the list is empty', () => {
    renderList({ initialItems: [] });

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(screen.getByText('Blog Posts')).toBeInTheDocument();
    expect(screen.queryByText(/Blog Posts \(/)).not.toBeInTheDocument();
    expect(screen.getByText('No items found.')).toBeInTheDocument();
  });

  it('shows no pager when the list is empty but a cursor remains', () => {
    renderList({ initialItems: [], initialLastKey: { id: 'cursor' } });

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('renders a header with no loaded-record count', () => {
    renderList({ initialItems: makeItems(10) });

    expect(screen.getByText('Blog Posts')).toBeInTheDocument();
    expect(screen.queryByText(/\(10\+?\)/)).not.toBeInTheDocument();
  });

  it('renders a header with no loaded-record count in a card', () => {
    renderList({ initialItems: makeItems(10), inCard: true });

    expect(screen.getByText('Blog Posts')).toBeInTheDocument();
    expect(screen.queryByText(/\(10\+?\)/)).not.toBeInTheDocument();
  });

  it('renders Page 1 with no denominator when items exist', () => {
    renderList({ initialItems: makeItems(10) });

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(screen.queryByText(/of/i)).not.toBeInTheDocument();
  });

  it('renders no pager when a single page is loaded and nothing more exists', () => {
    renderList({ initialItems: makeItems(5) });

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('moves to an already loaded page without fetching', async () => {
    const callApi = jest.fn();
    renderList({ initialItems: makeItems(10), callApi });

    fireEvent.click(screen.getAllByLabelText('Next page')[0]);

    await waitFor(() => expect(screen.getAllByText('Page 2').length).toBeGreaterThan(0));
    expect(screen.getByText('Item 6')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    expect(callApi).not.toHaveBeenCalled();
  });

  it('fetches the requested page and lands on it', async () => {
    const callApi = jest.fn().mockResolvedValue(jsonResponse({ items: makeItems(5, 5), lastKey: null }));
    renderList({ initialItems: makeItems(5), initialLastKey: { id: 'cursor' }, callApi });

    fireEvent.click(screen.getAllByLabelText('Next page')[0]);

    await waitFor(() => expect(screen.getAllByText('Page 2').length).toBeGreaterThan(0));
    expect(callApi).toHaveBeenCalledWith('/more', { lastKey: { id: 'cursor' } });
    expect(screen.getByText('Item 10')).toBeInTheDocument();
  });

  it('fills the requested page by display rows when countRows is supplied', async () => {
    const callApi = jest.fn().mockResolvedValue(jsonResponse({ items: makeItems(5, 5), lastKey: { id: 'next' } }));
    // Every pair of items collapses into one displayed row, so filling page two (ten rows)
    // takes twenty items — three more fetches — where raw item counting would stop after one.
    renderList({
      initialItems: makeItems(5),
      initialLastKey: { id: 'cursor' },
      callApi,
      countRows: (items) => Math.ceil(items.length / 2),
    });

    fireEvent.click(screen.getAllByLabelText('Next page')[0]);

    await waitFor(() => expect(screen.getAllByText('Page 2').length).toBeGreaterThan(0));
    expect(callApi).toHaveBeenCalledTimes(3);
  });
});
