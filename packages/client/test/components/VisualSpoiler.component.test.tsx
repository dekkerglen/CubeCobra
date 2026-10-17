import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';

import VisualSpoiler from 'components/cube/VisualSpoiler';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';

jest.mock('@utils/sorting/Sort', () => ({
  sortForDownload: (cards: Card[]) => cards,
}));

jest.mock('components/FoilCardImage', () => ({
  __esModule: true,
  default: ({ card, onClick }: { card: Card; onClick?: () => void }) => (
    <img alt={card.details!.name} data-index={card.index} onClick={onClick} />
  ),
}));

jest.mock('components/cubetray/useCubeTrayDrag', () => ({
  __esModule: true,
  default: () => ({ active: false }),
}));

const makeCard = (name: string, index: number, board = 'mainboard'): Card =>
  ({ cardID: `${name}-${index}`, index, board, details: { name } }) as Card;

const cards = [
  makeCard('Island', 0),
  makeCard('Island', 1),
  makeCard('Black Lotus', 2),
  makeCard('Island', 3),
  makeCard('Island', 0, 'maybeboard'),
];

const renderSpoiler = ({ collapse, canEdit = true }: { collapse: boolean; canEdit?: boolean }) => {
  const setModalSelection = jest.fn();
  const setModalOpen = jest.fn();
  const cubeValue = {
    cube: { id: 'cube-1', collapseDuplicateCards: collapse },
    canEdit,
    setModalSelection,
    setModalOpen,
  };

  render(
    <CubeContext.Provider value={cubeValue as any}>
      <DisplayContext.Provider value={{ cardsPerRow: 4 } as any}>
        <VisualSpoiler cards={cards} />
      </DisplayContext.Provider>
    </CubeContext.Provider>,
  );

  return { setModalSelection, setModalOpen };
};

describe('VisualSpoiler collapse duplicates', () => {
  it('shows every copy when collapsing is off', () => {
    renderSpoiler({ collapse: false });

    expect(screen.getAllByAltText('Island')).toHaveLength(4);
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('shows one image per name and board with a count on the first copy', () => {
    renderSpoiler({ collapse: true });

    const islands = screen.getAllByAltText('Island');
    expect(islands).toHaveLength(2);
    expect(islands[0]).toHaveAttribute('data-index', '0');
    expect(screen.getByText('×3')).toBeInTheDocument();
    expect(screen.getAllByAltText('Black Lotus')).toHaveLength(1);
    expect(screen.getAllByText(/×/)).toHaveLength(1);
  });

  it('opens the group modal with every copy for editors', () => {
    const { setModalSelection, setModalOpen } = renderSpoiler({ collapse: true });

    fireEvent.click(screen.getAllByAltText('Island')[0]);

    expect(setModalSelection).toHaveBeenCalledWith([
      { board: 'mainboard', index: 0 },
      { board: 'mainboard', index: 1 },
      { board: 'mainboard', index: 3 },
    ]);
    expect(setModalOpen).toHaveBeenCalledWith(true);
  });

  it('opens the first copy for viewers who cannot edit', () => {
    const { setModalSelection } = renderSpoiler({ collapse: true, canEdit: false });

    fireEvent.click(screen.getAllByAltText('Island')[0]);

    expect(setModalSelection).toHaveBeenCalledWith({ board: 'mainboard', index: 0 });
  });
});
