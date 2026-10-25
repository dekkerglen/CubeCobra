import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';

import Purchase from 'components/cardPage/Purchase';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

jest.mock('utils/analytics', () => ({ trackEvent: jest.fn() }));

const cardWith = (prices: CardDetails['prices']): CardDetails => ({
  ...getPlaceholderCardDetails('scryfall-id'),
  name: 'Soltari Foot Soldier',
  prices,
});

describe('Purchase', () => {
  it('covers the foil and etched prices that no other vendor row carries', () => {
    render(<Purchase card={cardWith({ usd: 0.44, usd_foil: 3.5, usd_etched: 12.25 })} />);

    expect(screen.getByText('$0.44')).toBeInTheDocument();
    expect(screen.getByText('$3.50')).toBeInTheDocument();
    expect(screen.getByText('$12.25')).toBeInTheDocument();
  });

  it('distinguishes the three TCGPlayer finishes by name', () => {
    render(<Purchase card={cardWith({ usd: 0.44, usd_foil: 3.5, usd_etched: 12.25 })} />);

    expect(screen.getByText('TCGPlayer')).toBeInTheDocument();
    expect(screen.getByText('TCGPlayer (Foil)')).toBeInTheDocument();
    expect(screen.getByText('TCGPlayer (Etched)')).toBeInTheDocument();
  });

  it('omits a finish the card was never printed in', () => {
    render(<Purchase card={cardWith({ usd: 0.44 })} />);

    expect(screen.getByText('TCGPlayer')).toBeInTheDocument();
    expect(screen.queryByText('TCGPlayer (Foil)')).not.toBeInTheDocument();
    expect(screen.queryByText('TCGPlayer (Etched)')).not.toBeInTheDocument();
  });

  it('treats a zero price as absent instead of leaking a bare 0 into the list', () => {
    const { container } = render(<Purchase card={cardWith({ usd: 0.44, usd_foil: 0, usd_etched: 0 })} />);

    // `{price && <Row/>}` renders the number 0 itself when the price is zero.
    const strayZeros = [...container.querySelectorAll('*')]
      .flatMap((element) => [...element.childNodes])
      .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent === '0');

    expect(strayZeros).toHaveLength(0);
    expect(screen.queryByText('TCGPlayer (Foil)')).not.toBeInTheDocument();
  });
});
