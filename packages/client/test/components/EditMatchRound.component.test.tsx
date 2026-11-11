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

  /**
   * The five fields sit in the site's Row/Col grid (the pattern EditPlayerList and the rest of
   * the app use) rather than one flex line. They were a flex row with the three counts held at
   * `w-20 shrink-0`, which kept their width by squeezing the two selects beside them — to 26px
   * on a 390px screen, where a select shows a chevron and no name at all.
   *
   * jsdom applies no media queries, so the reflow itself is verified by measurement in a
   * browser. What is assertable here is the contract that drives it: three columns at the base
   * size and nine from md up, with a pairing spanning the full width below md.
   */
  it('lays the match fields out on the responsive grid', () => {
    render(<Harness initialRound={{ matches: [match('Alice', 'Bob', [2, 1, 0])] }} />);

    const colOf = (label: string) => screen.getByLabelText(label).closest('[class*="col-span"]')!;

    for (const label of ['Player 1', 'Player 2']) {
      // Full width of a 3-column grid below md, a third of a 9-column one above it.
      expect(colOf(label).className).toContain('col-span-3');
      expect(colOf(label).className).toContain('md:col-span-3');
    }

    for (const label of ['Alice Wins', 'Bob Wins', 'Draws']) {
      expect(colOf(label).className).toContain('col-span-1');
      expect(colOf(label).className).toContain('md:col-span-1');
      // No longer holding their own width against the selects.
      expect(colOf(label).className).not.toContain('shrink-0');
    }

    const grid = colOf('Player 1').parentElement!;
    expect(grid.className).toContain('grid-cols-3');
    expect(grid.className).toContain('md:grid-cols-9');
  });

  // Above md the headings name the columns once for the whole list; below md there are no
  // columns to head, so each field carries its own label instead.
  it('labels every field for the stacked layout, hidden where the headings do that job', () => {
    render(<Harness initialRound={{ matches: [match('Alice', 'Bob', [2, 1, 0])] }} />);

    for (const label of ['Player 1', 'Player 2', 'P1 Wins', 'P2 Wins', 'Draws']) {
      const inRow = screen
        .getAllByText(label)
        .map((node) => node.closest('div.block.md\\:hidden'))
        .filter(Boolean);
      expect(inRow.length).toBeGreaterThan(0);
    }
  });

  // The per-control labels stacked above a 33px box and wrapped onto two lines. They are
  // kept as accessible names — "Alice Wins" says more than a column can — and said once
  // visibly, above the list, like the player rows do it.
  it('heads the match columns once rather than labelling every cell', () => {
    render(<Harness initialRound={{ matches: [match('Alice', 'Bob', [2, 1, 0])] }} />);

    const headings = screen.getByTestId('match-column-headings');
    // Not W/L/D: the three cells are the two players' win counts and the draws between
    // them, so the headings name whose column each one is rather than a result type.
    for (const label of ['Player 1', 'Player 2', 'P1 Wins', 'P2 Wins', 'Draws']) {
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

  it('offers adding a match as a quiet control rather than a filled button', () => {
    render(<Harness initialRound={{ matches: [match('Alice', 'Bob', [2, 1, 0])] }} />);

    const add = screen.getByRole('button', { name: 'Add Match' });
    expect(add.parentElement).toHaveClass('justify-start');
    // Adding a row to a round is routine; it was carrying the same weight as Save.
    expect(add.className).not.toMatch(/bg-button/);
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
