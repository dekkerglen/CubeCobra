import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import CardBreakdownStats from 'components/cardPage/Stats';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

jest.mock('components/modals/AddToCubeModal', () => ({
  __esModule: true,
  default: () => <div />,
}));

const card: CardDetails = {
  ...getPlaceholderCardDetails('scryfall-id'),
  name: 'Soltari Foot Soldier',
  popularity: 0.43,
  cubeCount: 1384,
  elo: 1158,
  prices: { usd: 0.44, usd_foil: 3.5, usd_etched: 12.25, eur: 0.92, tix: 0.04 },
};

const noHistory = [{} as HistoryType];

describe('card page stats column', () => {
  it.each([
    ['TCGPlayer Market Price'],
    ['Foil TCGPlayer Market Price'],
    ['Etched (TCGPlayer Market Price)'],
    ['Cardmarket Price'],
    ['MTGO TIX'],
  ])('leaves %s to the Purchase section', (label) => {
    render(<CardBreakdownStats card={card} history={noHistory} />);

    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it('folds the standalone elo badge into the metrics panel', () => {
    render(<CardBreakdownStats card={card} history={noHistory} />);

    expect(screen.getByRole('region', { name: 'Elo' })).toBeInTheDocument();
    expect(screen.queryByText('Elo', { selector: 'div' })).not.toBeInTheDocument();
  });

  it('replaces the popularity sentence with the metrics panel', () => {
    render(<CardBreakdownStats card={card} history={noHistory} />);

    expect(screen.queryByText(/cubes total/)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Play Rate' })).toBeInTheDocument();
  });

  it('keeps the actions and identifiers that live nowhere else', () => {
    render(<CardBreakdownStats card={card} history={noHistory} />);

    expect(screen.getByText('Add to Cube')).toBeInTheDocument();
    expect(screen.getByDisplayValue('scryfall-id')).toBeInTheDocument();
  });

  it('puts the id field directly under the card image, ahead of the actions', () => {
    const { container } = render(<CardBreakdownStats card={card} history={noHistory} />);

    const order = [...container.querySelectorAll('img, input, button')];
    const image = order.findIndex((el) => el.tagName === 'IMG');
    const idField = order.findIndex((el) => (el as HTMLInputElement).value === 'scryfall-id');
    const addToCube = order.findIndex((el) => el.textContent === 'Add to Cube');

    expect(image).toBeLessThan(idField);
    expect(idField).toBeLessThan(addToCube);
  });

  it('offers the cube and package searches without repeating the card name', () => {
    render(<CardBreakdownStats card={card} history={noHistory} />);

    // The card's name is the page heading; echoing it in every button was noise.
    expect(screen.getByText('Cubes')).toBeInTheDocument();
    expect(screen.getByText('Packages')).toBeInTheDocument();
    expect(screen.queryByText(/with Soltari Foot Soldier/)).not.toBeInTheDocument();
  });

  it('puts the cube and package searches below the metrics they are secondary to', () => {
    const { container } = render(<CardBreakdownStats card={card} history={noHistory} />);

    const nodes = [...container.querySelectorAll('section[aria-label], a')];
    const elo = nodes.findIndex((el) => el.getAttribute('aria-label') === 'Elo');
    const cubes = nodes.findIndex((el) => el.textContent === 'Cubes');

    expect(elo).toBeGreaterThan(-1);
    expect(cubes).toBeGreaterThan(elo);
  });

  it('points the cube and package searches at this card', () => {
    render(<CardBreakdownStats card={card} history={noHistory} />);

    expect(screen.getByText('Cubes').closest('a')).toHaveAttribute('href', expect.stringContaining('/search/'));
    expect(screen.getByText('Packages').closest('a')).toHaveAttribute('href', expect.stringContaining('/packages'));
    expect(screen.getByText('Cubes').closest('a')).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent('card:"Soltari Foot Soldier"')),
    );
  });
});
