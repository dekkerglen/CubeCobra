import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import CardBreakdownStats from 'components/cardPage/Stats';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

jest.mock('components/modals/AddToCubeModal', () => ({
  __esModule: true,
  default: () => <div />,
}));

// jsdom loads no images, so the real component always swaps in its placeholder on error
// and hides which URL the face toggle picked. The fallback is tested on its own.
jest.mock('components/ImageFallback', () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <img src={src} alt={alt} className={className} />
  ),
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

// Four layouts carry a back face, but only one of them actually transforms.
const twoFaced = (layout: string): CardDetails => ({
  ...card,
  layout,
  image_flip: 'https://cards.scryfall.io/normal/back/1/1/back.jpg',
});

describe('two-faced cards', () => {
  it('offers no face toggle for a card with only one face', () => {
    render(<CardBreakdownStats card={card} history={noHistory} />);

    expect(screen.queryByRole('button', { name: /transform|flip/i })).not.toBeInTheDocument();
  });

  it('calls it a transform only when the card actually transforms', () => {
    render(<CardBreakdownStats card={twoFaced('transform')} history={noHistory} />);

    expect(screen.getByRole('button', { name: 'Transform' })).toBeInTheDocument();
  });

  it.each([['modal_dfc'], ['double_faced_token'], ['reversible_card']])(
    'calls it a flip for %s, which has two faces but never transforms',
    (layout) => {
      render(<CardBreakdownStats card={twoFaced(layout)} history={noHistory} />);

      expect(screen.getByRole('button', { name: 'Flip' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Transform' })).not.toBeInTheDocument();
    },
  );

  it('falls back to the neutral word when the layout is unknown', () => {
    render(
      <CardBreakdownStats
        card={{ ...twoFaced('transform'), layout: undefined as unknown as string }}
        history={noHistory}
      />,
    );

    expect(screen.getByRole('button', { name: 'Flip' })).toBeInTheDocument();
  });

  it('shows the back face once the toggle is used, and returns on a second press', () => {
    render(<CardBreakdownStats card={twoFaced('transform')} history={noHistory} />);
    const toggle = screen.getByRole('button', { name: 'Transform' });
    const image = screen.getByAltText('Soltari Foot Soldier');

    fireEvent.click(toggle);
    expect(image).toHaveAttribute('src', twoFaced('transform').image_flip);

    fireEvent.click(toggle);
    expect(image).toHaveAttribute('src', card.image_normal);
  });
});

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
    // One "Elo" on the page: the panel's own label. The separate badge is gone.
    expect(screen.getAllByText('Elo')).toHaveLength(1);
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

  it('puts the id field below the metrics and above the cube and package searches', () => {
    const { container } = render(<CardBreakdownStats card={card} history={noHistory} />);

    const nodes = [...container.querySelectorAll('section[aria-label], input, a')];
    const elo = nodes.findIndex((el) => el.getAttribute('aria-label') === 'Elo');
    const idField = nodes.findIndex((el) => (el as HTMLInputElement).value === 'scryfall-id');
    const cubes = nodes.findIndex((el) => el.textContent === 'Cubes');

    expect(elo).toBeGreaterThan(-1);
    expect(idField).toBeGreaterThan(elo);
    expect(cubes).toBeGreaterThan(idField);
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
