import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Card from '@utils/datatypes/Card';

import { CompareSet, CompareSides } from 'components/compare/CompareArt';
import CompareView from 'components/compare/CompareView';
import DisplayContext from 'contexts/DisplayContext';

import { defaultDisplayContext } from '../../../server/test/test-utils/context';

jest.mock('components/card/AutocardListItem', () => () => <div />);
jest.mock('components/cube/CubeCardsView', () => ({
  __esModule: true,
  default: ({ view, cards }: { view: string; cards: Card[] }) => (
    <div data-testid="cards-view" data-view={view}>
      {cards.map((c) => c.index).join(',')}
    </div>
  ),
}));

const side = (title: string) => ({
  kicker: title,
  title,
  image: { uri: '', artist: '', id: '', imageName: '' },
  cardCount: 0,
});

const sides: CompareSides = {
  a: side('A'),
  b: side('B'),
  captions: { onlyA: 'Only in A', both: 'In both', onlyB: 'Only in B' },
};

const cards = [0, 1, 2, 3].map((index) => ({ index, cardID: `card-${index}`, details: undefined }) as unknown as Card);

const renderView = (focus: CompareSet | null, displayView = 'table') =>
  render(
    <DisplayContext.Provider value={{ ...defaultDisplayContext, displayView }}>
      <CompareView cards={cards} onlyA={[0, 1]} both={[2]} onlyB={[3]} sides={sides} focus={focus} />
    </DisplayContext.Provider>,
  );

describe('CompareView', () => {
  it('renders the selected set through CubeCardsView with the current display view', () => {
    renderView('onlyA', 'spoiler');

    const view = screen.getByTestId('cards-view');
    expect(view).toHaveTextContent('0,1');
    expect(view).toHaveAttribute('data-view', 'spoiler');
  });

  it('does not render CubeCardsView without a focus', () => {
    renderView(null);

    expect(screen.queryByTestId('cards-view')).toBeNull();
  });
});
