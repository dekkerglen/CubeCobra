import React from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';

import Purchase from 'components/cardPage/Purchase';
import { trackEvent } from 'utils/analytics';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

jest.mock('utils/analytics', () => ({ trackEvent: jest.fn() }));

const cardWith = (prices: CardDetails['prices']): CardDetails => ({
  ...getPlaceholderCardDetails('scryfall-id'),
  name: 'Soltari Foot Soldier',
  prices,
});

const allPrices = { usd: 0.44, usd_foil: 3.5, usd_etched: 12.25, ck: 1.1, mp: 1.27, eur: 0.92, tix: 0.04 };

const rowFor = (vendor: string) => screen.getByText(vendor).closest('tr') as HTMLElement;

beforeEach(() => jest.clearAllMocks());

describe('Purchase', () => {
  it('lists the vendors as table rows rather than a stack of buttons', () => {
    const { container } = render(<Purchase card={cardWith(allPrices)} />);

    expect(container.querySelector('table')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('covers the foil and etched prices that no other vendor row carries', () => {
    render(<Purchase card={cardWith(allPrices)} />);

    expect(within(rowFor('TCGPlayer')).getByText('$0.44')).toBeInTheDocument();
    expect(within(rowFor('TCGPlayer (Foil)')).getByText('$3.50')).toBeInTheDocument();
    expect(within(rowFor('TCGPlayer (Etched)')).getByText('$12.25')).toBeInTheDocument();
  });

  it('shows each vendor in its own currency', () => {
    render(<Purchase card={cardWith(allPrices)} />);

    expect(within(rowFor('Cardmarket')).getByText('€0.92')).toBeInTheDocument();
    expect(within(rowFor('Cardhoarder')).getByText('0.04 TIX')).toBeInTheDocument();
  });

  it('points each vendor at its own storefront', () => {
    render(<Purchase card={cardWith(allPrices)} />);

    expect(screen.getByText('Cardmarket')).toHaveAttribute('href', expect.stringContaining('cardmarket'));
    expect(screen.getByText('Mana Pool')).toHaveAttribute('href', expect.stringContaining('manapool'));
  });

  it('still reports an affiliate click now that the vendors are links', () => {
    render(<Purchase card={cardWith(allPrices)} />);

    fireEvent.click(screen.getByText('Card Kingdom'));

    expect(trackEvent).toHaveBeenCalledWith('affiliate_click', {
      vendor: 'cardkingdom',
      scope: 'single',
      cards_value: 1.1,
    });
  });

  it('reports every TCGPlayer finish under the one vendor, with its own price', () => {
    render(<Purchase card={cardWith(allPrices)} />);

    fireEvent.click(screen.getByText('TCGPlayer (Etched)'));

    expect(trackEvent).toHaveBeenCalledWith('affiliate_click', {
      vendor: 'tcgplayer',
      scope: 'single',
      cards_value: 12.25,
    });
  });

  it('omits a finish the card was never printed in', () => {
    render(<Purchase card={cardWith({ usd: 0.44 })} />);

    expect(screen.getByText('TCGPlayer')).toBeInTheDocument();
    expect(screen.queryByText('TCGPlayer (Foil)')).not.toBeInTheDocument();
    expect(screen.queryByText('TCGPlayer (Etched)')).not.toBeInTheDocument();
  });

  it('treats a zero price as absent instead of leaking a bare 0 into the list', () => {
    const { container } = render(<Purchase card={cardWith({ usd: 0.44, usd_foil: 0, usd_etched: 0 })} />);

    const strayZeros = [...container.querySelectorAll('*')]
      .flatMap((element) => [...element.childNodes])
      .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent === '0');

    expect(strayZeros).toHaveLength(0);
    expect(screen.queryByText('TCGPlayer (Foil)')).not.toBeInTheDocument();
  });

  it('still offers a vendor whose price is unknown', () => {
    render(<Purchase card={cardWith({ usd: 0.44 })} />);

    // Card Kingdom has no price here, but its storefront link is still worth showing.
    expect(screen.getByText('Card Kingdom')).toBeInTheDocument();
  });
});
