import React, { useState } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import IndefinitePaginatedTable from 'components/IndefinitePaginatedTable';
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
}

const renderTable = ({
  initialItems = [],
  initialLastKey = null,
  callApi = jest.fn(),
  pageSize = 5,
  inCard = false,
}: HarnessOptions = {}) => {
  const Harness: React.FC = () => {
    const [items, setItems] = useState<Item[]>(initialItems);
    const [lastKey, setLastKey] = useState<any>(initialLastKey);

    return (
      <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch: jest.fn(), callApi } as any}>
        <IndefinitePaginatedTable<Item>
          items={items}
          setItems={setItems}
          lastKey={lastKey}
          setLastKey={setLastKey}
          fetchMoreRoute="/more"
          renderItem={(item) => ({ Name: item.name })}
          headers={['Name']}
          pageSize={pageSize}
          header="Decks"
          inCard={inCard}
        />
      </CSRFContext.Provider>
    );
  };

  return render(<Harness />);
};

describe('IndefinitePaginatedTable', () => {
  it('shows no pager and no count when the table is empty', () => {
    renderTable({ initialItems: [] });

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(screen.getByText('Decks')).toBeInTheDocument();
    expect(screen.queryByText(/Decks \(/)).not.toBeInTheDocument();
    expect(screen.getByText('No items found.')).toBeInTheDocument();
  });

  it('renders a header with no loaded-record count', () => {
    renderTable({ initialItems: makeItems(10), initialLastKey: { id: 'cursor' } });

    expect(screen.getByText('Decks')).toBeInTheDocument();
    expect(screen.queryByText(/\(10\+?\)/)).not.toBeInTheDocument();
  });

  it('renders a header with no loaded-record count in a card', () => {
    renderTable({ initialItems: makeItems(10), initialLastKey: { id: 'cursor' }, inCard: true });

    expect(screen.getByText('Decks')).toBeInTheDocument();
    expect(screen.queryByText(/\(10\+?\)/)).not.toBeInTheDocument();
  });

  it('renders Page 1 with no denominator when items exist', () => {
    renderTable({ initialItems: makeItems(10) });

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(screen.queryByText(/ of /i)).not.toBeInTheDocument();
  });

  it('moves to an already loaded page without fetching', async () => {
    const callApi = jest.fn();
    renderTable({ initialItems: makeItems(10), callApi });

    fireEvent.click(screen.getAllByLabelText('Next page')[0]);

    await waitFor(() => expect(screen.getAllByText('Page 2').length).toBeGreaterThan(0));
    expect(screen.getByText('Item 6')).toBeInTheDocument();
    expect(callApi).not.toHaveBeenCalled();
  });

  it('fetches the requested page and lands on it', async () => {
    const callApi = jest.fn().mockResolvedValue(jsonResponse({ items: makeItems(5, 5), lastKey: null }));
    renderTable({ initialItems: makeItems(5), initialLastKey: { id: 'cursor' }, callApi });

    fireEvent.click(screen.getAllByLabelText('Next page')[0]);

    await waitFor(() => expect(screen.getAllByText('Page 2').length).toBeGreaterThan(0));
    expect(callApi).toHaveBeenCalledWith('/more', { lastKey: { id: 'cursor' } });
    expect(screen.getByText('Item 10')).toBeInTheDocument();
  });
});
