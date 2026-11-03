import React, { useState } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import { Match, PlayerList, Round } from '@utils/datatypes/Record';

import EditMatchRound from '../../src/records/EditMatchRound';

const players: PlayerList = [
  { name: 'Alice' },
  { name: 'Bob' },
  { name: 'Carol' },
  { name: 'Dave' },
  { name: 'Erin' },
  { name: 'Frank' },
];

const match = (p1: string, p2: string, results: [number, number, number]): Match => ({ p1, p2, results });

// EditMatchRound is controlled by its parent, so the harness owns the round the way the modals do.
// `onChange` records what the component handed back, which is the payload the modals serialize.
const Harness: React.FC<{ initialRound: Round; onChange?: (round: Round) => void }> = ({ initialRound, onChange }) => {
  const [round, setRound] = useState<Round>(initialRound);

  return (
    <EditMatchRound
      players={players}
      round={round}
      setRound={(next) => {
        setRound(next);
        onChange?.(next);
      }}
    />
  );
};

describe('EditMatchRound', () => {
  it('renders player selects and three result inputs per match', () => {
    render(
      <Harness initialRound={{ matches: [match('Alice', 'Bob', [2, 1, 0]), match('Carol', 'Dave', [0, 0, 3])] }} />,
    );

    expect(screen.getAllByLabelText('Player 1')).toHaveLength(2);
    expect(screen.getAllByLabelText('Player 2')).toHaveLength(2);

    expect(screen.getByLabelText('Alice Wins')).toHaveValue(2);
    expect(screen.getByLabelText('Bob Wins')).toHaveValue(1);
    expect(screen.getByLabelText('Carol Wins')).toHaveValue(0);
    expect(screen.getByLabelText('Dave Wins')).toHaveValue(0);

    const draws = screen.getAllByLabelText('Draws');
    expect(draws).toHaveLength(2);
    expect(draws[0]).toHaveValue(0);
    expect(draws[1]).toHaveValue(3);
  });

  it('updates results[0] when the first win count changes', () => {
    const onChange = jest.fn();
    render(<Harness initialRound={{ matches: [match('Alice', 'Bob', [0, 0, 1])] }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Alice Wins'), { target: { value: '2' } });

    expect(onChange).toHaveBeenCalledWith({ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 0, 1] }] });
    expect(screen.getByLabelText('Alice Wins')).toHaveValue(2);
    expect(screen.getByLabelText('Bob Wins')).toHaveValue(0);
    expect(screen.getByLabelText('Draws')).toHaveValue(1);
  });

  it('labels the win inputs with the currently selected player names', () => {
    render(<Harness initialRound={{ matches: [match('Alice', 'Bob', [1, 0, 0])] }} />);

    fireEvent.change(screen.getByLabelText('Player 2'), { target: { value: 'Carol' } });

    expect(screen.queryByLabelText('Bob Wins')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Carol Wins')).toHaveValue(0);
    expect(screen.getByLabelText('Alice Wins')).toHaveValue(1);
  });

  it('adds a match with results zeroed', () => {
    const onChange = jest.fn();
    render(<Harness initialRound={{ matches: [match('Alice', 'Bob', [2, 1, 0])] }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Match' }));

    expect(onChange).toHaveBeenCalledWith({
      matches: [
        { p1: 'Alice', p2: 'Bob', results: [2, 1, 0] },
        { p1: 'Unknown Opponent', p2: 'Unknown Opponent', results: [0, 0, 0] },
      ],
    });

    const draws = screen.getAllByLabelText('Draws');
    expect(draws).toHaveLength(2);
    expect(draws[1]).toHaveValue(0);
    expect(screen.getAllByLabelText('Unknown Opponent Wins')).toHaveLength(2);
  });

  it('removes the right match when there are three', () => {
    const onChange = jest.fn();
    render(
      <Harness
        initialRound={{
          matches: [
            match('Alice', 'Bob', [2, 0, 0]),
            match('Carol', 'Dave', [1, 1, 1]),
            match('Erin', 'Frank', [0, 2, 0]),
          ],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove match 2' }));

    expect(onChange).toHaveBeenCalledWith({
      matches: [
        { p1: 'Alice', p2: 'Bob', results: [2, 0, 0] },
        { p1: 'Erin', p2: 'Frank', results: [0, 2, 0] },
      ],
    });

    expect(screen.queryByLabelText('Carol Wins')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Alice Wins')).toHaveValue(2);
    expect(screen.getByLabelText('Frank Wins')).toHaveValue(2);
  });

  // Seven controls share one row — two player selects, three result counts and Remove — so
  // the counts are narrowed rather than each claiming the full width of the row. The Input
  // escape hatch *replaces* the default `block w-full`, so `w-full` has to be gone from the
  // wrapper rather than merely overridden by a later class. `shrink-0` is the other half:
  // without it the two selects beside them squeeze a w-20 cell down to a third of that.
  it('narrows the three result inputs to the width of a count', () => {
    render(<Harness initialRound={{ matches: [match('Alice', 'Bob', [2, 1, 0])] }} />);

    for (const label of ['Alice Wins', 'Bob Wins', 'Draws']) {
      // wrapper > div.relative > input
      const wrapper = screen.getByLabelText(label).parentElement!.parentElement!;
      expect(wrapper).toHaveClass('w-20');
      expect(wrapper).toHaveClass('shrink-0');
      expect(wrapper).not.toHaveClass('w-full');
    }
  });

  // The per-control labels stacked above a 33px box and wrapped onto two lines. They are
  // kept as accessible names — "Alice Wins" says more than a column can — and said once
  // visibly, above the list, like the player rows do it.
  it('heads the match columns once rather than labelling every cell', () => {
    render(<Harness initialRound={{ matches: [match('Alice', 'Bob', [2, 1, 0])] }} />);

    const headings = screen.getByTestId('match-column-headings');
    for (const label of ['Player 1', 'Player 2', 'W', 'W', 'D']) {
      expect(within(headings).getAllByText(label).length).toBeGreaterThan(0);
    }

    // Still reachable by name, and still carrying a per-cell hint.
    expect(screen.getByLabelText('Alice Wins')).toHaveAttribute('title', 'Alice Wins');
    // ...but no longer rendered as a visible label above a narrow box.
    expect(screen.queryByText('Alice Wins')).not.toBeInTheDocument();
  });

  it('offers no headings when a round has no matches yet', () => {
    render(<Harness initialRound={{ matches: [] }} />);

    expect(screen.queryByTestId('match-column-headings')).not.toBeInTheDocument();
  });

  it('keeps Add Match to its own width rather than the full row', () => {
    render(<Harness initialRound={{ matches: [match('Alice', 'Bob', [2, 1, 0])] }} />);

    const add = screen.getByRole('button', { name: 'Add Match' });
    expect(add.parentElement).toHaveClass('justify-start');
  });

  it('binds each editor to its own controls when two rounds are on the page', () => {
    render(
      <>
        <Harness initialRound={{ matches: [match('Alice', 'Bob', [2, 0, 0])] }} />
        <Harness initialRound={{ matches: [match('Carol', 'Dave', [0, 1, 0])] }} />
      </>,
    );

    fireEvent.change(screen.getAllByLabelText('Player 1')[1], { target: { value: 'Erin' } });

    expect(screen.getByLabelText('Alice Wins')).toHaveValue(2);
    expect(screen.getByLabelText('Erin Wins')).toHaveValue(0);
    expect(screen.queryByLabelText('Carol Wins')).not.toBeInTheDocument();
  });
});
