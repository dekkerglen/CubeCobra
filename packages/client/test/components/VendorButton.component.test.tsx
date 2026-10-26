import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';

import VendorButton from 'components/purchase/VendorButton';
import { trackEvent } from 'utils/analytics';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

jest.mock('utils/analytics', () => ({ trackEvent: jest.fn() }));

const card: CardDetails = {
  ...getPlaceholderCardDetails('scryfall-id'),
  name: 'Soltari Foot Soldier',
  prices: { usd: 0.44, ck: 1.1, eur: 0.92 },
};

beforeEach(() => jest.clearAllMocks());

describe('VendorButton', () => {
  it('labels and prices the vendor it was asked for', () => {
    render(<VendorButton card={card} optionId="cardkingdom" />);

    expect(screen.getByText('Card Kingdom')).toBeInTheDocument();
    expect(screen.getByText('$1.10')).toBeInTheDocument();
  });

  it('reports the click against that vendor', () => {
    render(<VendorButton card={card} optionId="cardmarket" />);

    fireEvent.click(screen.getByText('CardMarket'));

    expect(trackEvent).toHaveBeenCalledWith('affiliate_click', {
      vendor: 'cardmarket',
      scope: 'single',
      cards_value: 0.92,
    });
  });

  it('renders nothing for a finish this card was not printed in', () => {
    const { container } = render(<VendorButton card={card} optionId="tcgplayer-foil" />);

    expect(container).toBeEmptyDOMElement();
  });
});
