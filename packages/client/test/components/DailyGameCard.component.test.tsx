import React from 'react';

import { DailyGameTeaserResult } from '@utils/datatypes/DailyGameTeaser';
import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import DailyGameCard from 'components/dailies/DailyGameCard';

const CROSSWORD: DailyGameTeaserResult = {
  teaser: {
    game: 'crossword',
    shape: {
      date: '2026-09-29',
      width: 3,
      height: 3,
      blocks: [
        [false, false, false],
        [false, false, false],
        [false, false, true],
      ],
      clueCount: 5,
    },
  },
  allPlayed: false,
};

const SYNERGY_CONNECT: DailyGameTeaserResult = {
  teaser: {
    game: 'synergyconnect',
    board: {
      date: '2026-09-29',
      theme: { filterText: 'keyword:Flying', description: 'with flying' },
      cards: Array.from({ length: 16 }, (_, index) => ({
        name: `Card ${index}`,
        oracleId: `oracle-${index}`,
      })),
      solvedGroups: [],
    },
  },
  allPlayed: false,
};

const category = (description: string) => ({ filterText: description, description });

const MANA_MATRIX: DailyGameTeaserResult = {
  teaser: {
    game: 'manamatrix',
    puzzle: {
      id: '2026-09-29',
      type: 'HISTORY',
      date: '2026-09-29',
      columns: [category('green'), category('mana value 1'), category('an Elf')],
      rows: [category('blue'), category('mana value 2'), category('a Goblin')],
      counts: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      isActive: true,
      dateCreated: 0,
      dateLastUpdated: 0,
    },
  },
  allPlayed: false,
};

const DAILY_P1P1 = {
  teaser: {
    game: 'dailyp1p1',
    pack: { id: 'pack-1' },
    cube: { id: 'cube-1', name: 'A Cube' },
    date: 1_800_000_000_000,
  },
  allPlayed: false,
} as unknown as DailyGameTeaserResult;

describe('DailyGameCard', () => {
  it('renders the Mana Matrix board with no progress to report', () => {
    render(<DailyGameCard dailyGame={MANA_MATRIX} />);

    expect(screen.getByText(/Mana Matrix/)).toBeInTheDocument();
    // Only ever shown for a puzzle this viewer hasn't started, so it always invites
    // rather than resuming.
    expect(screen.getByText(/Play today's puzzle/)).toBeInTheDocument();
    expect(screen.queryByText(/Continue playing/)).not.toBeInTheDocument();
  });

  it('renders the Daily P1P1 pack', () => {
    const { container } = render(<DailyGameCard dailyGame={DAILY_P1P1} />);

    expect(screen.getByText(/Daily Pack 1 Pick 1/)).toBeInTheDocument();
    expect(container.querySelector('a[href="/tool/p1p1/pack-1"]')).toBeInTheDocument();
  });

  it('renders the crossword as a grid of cells and nothing readable', () => {
    const { container } = render(<DailyGameCard dailyGame={CROSSWORD} />);

    expect(screen.getByText(/Crossword/)).toBeInTheDocument();
    expect(screen.getByText(/5 clues/)).toBeInTheDocument();
    expect(container.querySelector('a[href="/tool/crossword"]')).toBeInTheDocument();

    // Nine cells, one of them black, and no letters anywhere — the card is handed a
    // shape, so there is nothing else it could draw.
    const grid = screen.getByRole('img');
    expect(grid.children).toHaveLength(9);
    expect(grid.querySelectorAll('.bg-black')).toHaveLength(1);
    expect(grid.textContent).toEqual('');
  });

  it('renders the Synergy Connect board as sixteen tiles', () => {
    render(<DailyGameCard dailyGame={SYNERGY_CONNECT} />);

    expect(screen.getByText(/Synergy Connect/)).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(16);
    // Small source on purpose: these tiles render near 140px, and making the
    // browser squeeze the 488px image down is what made them look aliased.
    expect(screen.getByAltText('Card 0')).toHaveAttribute('src', '/tool/cardimage/oracle-0?size=small');
  });

  it('acknowledges a viewer who has played everything, with a way back to each game', () => {
    const { container } = render(<DailyGameCard dailyGame={{ teaser: null, allPlayed: true }} />);

    expect(screen.getByText(/You've played today's games/)).toBeInTheDocument();
    for (const href of ['/tool/manamatrix', '/tool/synergyconnect', '/tool/crossword', '/tool/p1p1/daily']) {
      expect(container.querySelector(`a[href="${href}"]`)).toBeInTheDocument();
    }
  });

  it('renders nothing when there is no daily game to show', () => {
    // A day with no live puzzles, or a failed read. Congratulating someone here would
    // be wrong, and so would an empty card.
    expect(render(<DailyGameCard dailyGame={{ teaser: null, allPlayed: false }} />).container).toBeEmptyDOMElement();
    expect(render(<DailyGameCard dailyGame={null} />).container).toBeEmptyDOMElement();
    expect(render(<DailyGameCard />).container).toBeEmptyDOMElement();
  });
});
