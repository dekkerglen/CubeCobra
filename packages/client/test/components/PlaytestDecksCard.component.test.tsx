import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Draft from '@utils/datatypes/Draft';

import PlaytestDecksCard from 'components/PlaytestDecksCard';
import { CSRFContext } from 'contexts/CSRFContext';

jest.mock('components/DeckPreview', () => ({
  __esModule: true,
  default: ({ deck }: any) => <div>{deck.name}</div>,
}));

const makeDecks = (count: number): Draft[] =>
  Array.from({ length: count }, (_, index) => ({ id: `d${index + 1}`, name: `Deck ${index + 1}` }) as Draft);

const renderCard = (decks: Draft[], decksLastKey: any = null, csrfFetch = jest.fn()) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <PlaytestDecksCard decks={decks} decksLastKey={decksLastKey} cubeId="cube-1" />
    </CSRFContext.Provider>,
  );

describe('PlaytestDecksCard', () => {
  it('renders the header with no loaded-record count', () => {
    renderCard(makeDecks(3));

    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.queryByText(/Drafts \(/)).not.toBeInTheDocument();
  });

  it('shows no pager when there are no drafts', () => {
    renderCard([]);

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(screen.getByText('No drafts yet.')).toBeInTheDocument();
  });

  // The footer is a bordered strip; before it tracked the pager's own visibility rule it drew as an
  // empty divider under every cube whose drafts fit on one page, which is the common case.
  it('draws no empty bordered footer when every draft fits on one page', () => {
    const { container } = renderCard(makeDecks(3));

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(container.querySelector('.border-t')).toBeNull();
    expect(screen.getByText('Deck 1')).toBeInTheDocument();
  });

  it('draws no empty bordered footer when there are no drafts at all', () => {
    const { container } = renderCard([]);

    expect(container.querySelector('.border-t')).toBeNull();
  });

  it('draws the bordered footer once there is a pager to put in it', () => {
    const { container } = renderCard(makeDecks(3), { id: 'cursor' });

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(container.querySelector('.border-t')).not.toBeNull();
  });
});
