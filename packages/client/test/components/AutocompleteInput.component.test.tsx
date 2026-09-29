import React, { useState } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import AutocompleteInput from 'components/base/AutocompleteInput';

// What /tool/api/cardnames actually returns: DEFAULT_LIMIT is 12. The highlight
// used to be clamped to index 9, so the last two were keyboard-unreachable.
const MATCHES = Array.from({ length: 12 }, (_, index) => `Bolt Number ${index + 1}`);

const ARROW_DOWN = 40;
const ARROW_UP = 38;
const ENTER = 13;

interface HarnessProps {
  matches?: string[];
  onSubmit?: (event: React.FormEvent<HTMLInputElement>, match?: string) => void;
}

const Harness: React.FC<HarnessProps> = ({ matches = MATCHES, onSubmit }) => {
  const [value, setValue] = useState('');
  // Stable identity: a fresh fetcher each render would clear the input's cache.
  const [getMatches] = useState(() => async () => matches);

  return (
    <>
      <AutocompleteInput
        getMatches={getMatches}
        value={value}
        setValue={setValue}
        onSubmit={onSubmit}
        placeholder="Card name"
        showImages={false}
      />
      <div data-testid="value">{value}</div>
    </>
  );
};

const typeQuery = async (query = 'bol') => {
  const input = screen.getByPlaceholderText('Card name');
  fireEvent.change(input, { target: { value: query } });
  // The lookup is debounced by 150ms, so the rows arrive a tick later.
  await waitFor(() => expect(screen.getByText(MATCHES[MATCHES.length - 1]!)).toBeInTheDocument());
  return input;
};

const isHighlighted = (text: string): boolean => screen.getByText(text).className.split(/\s+/).includes('bg-bg-active');

const highlightedTexts = (): string[] => MATCHES.filter(isHighlighted);

describe('AutocompleteInput keyboard navigation', () => {
  it('reaches the last suggestion, not three short of it', async () => {
    render(<Harness />);
    const input = await typeQuery();

    for (let press = 0; press < MATCHES.length; press++) {
      fireEvent.keyDown(input, { keyCode: ARROW_DOWN });
    }

    expect(highlightedTexts()).toEqual([MATCHES[MATCHES.length - 1]]);
  });

  it('highlights exactly one row, stepping one row per press', async () => {
    render(<Harness />);
    const input = await typeQuery();

    fireEvent.keyDown(input, { keyCode: ARROW_DOWN });
    expect(highlightedTexts()).toEqual([MATCHES[0]]);
    fireEvent.keyDown(input, { keyCode: ARROW_DOWN });
    expect(highlightedTexts()).toEqual([MATCHES[1]]);
  });

  it('wraps from the last row back to the first', async () => {
    render(<Harness />);
    const input = await typeQuery();

    for (let press = 0; press < MATCHES.length + 1; press++) {
      fireEvent.keyDown(input, { keyCode: ARROW_DOWN });
    }

    expect(highlightedTexts()).toEqual([MATCHES[0]]);
  });

  it('wraps upwards from the top, so Up from nothing selected reaches the last row', async () => {
    render(<Harness />);
    const input = await typeQuery();

    // Nothing is highlighted until an arrow key is pressed.
    expect(highlightedTexts()).toEqual([]);
    fireEvent.keyDown(input, { keyCode: ARROW_UP });
    expect(highlightedTexts()).toEqual([MATCHES[MATCHES.length - 1]]);
    fireEvent.keyDown(input, { keyCode: ARROW_UP });
    expect(highlightedTexts()).toEqual([MATCHES[MATCHES.length - 2]]);
  });

  it('accepts the last suggestion once it can be highlighted', async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = await typeQuery();

    for (let press = 0; press < MATCHES.length; press++) {
      fireEvent.keyDown(input, { keyCode: ARROW_DOWN });
    }
    fireEvent.keyDown(input, { keyCode: ENTER });

    const last = MATCHES[MATCHES.length - 1]!;
    expect(screen.getByTestId('value')).toHaveTextContent(last);
    expect(onSubmit).toHaveBeenCalledWith(expect.anything(), last);
  });

  it('keeps the highlight off the list when there is nothing to highlight', async () => {
    render(<Harness matches={[]} />);
    const input = screen.getByPlaceholderText('Card name');
    fireEvent.change(input, { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.queryByText(MATCHES[0]!)).not.toBeInTheDocument());

    // No crash, and nothing invisible gets selected for ENTER to commit.
    fireEvent.keyDown(input, { keyCode: ARROW_DOWN });
    fireEvent.keyDown(input, { keyCode: ENTER });
    expect(screen.getByTestId('value')).toHaveTextContent('zzz');
  });
});
