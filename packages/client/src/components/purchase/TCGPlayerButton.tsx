import React from 'react';

import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';

import { getTCGLink } from 'utils/Affiliate';
import { trackEvent } from 'utils/analytics';

import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

export type TCGPlayerFinish = 'nonfoil' | 'foil' | 'etched';

const FINISHES: Record<TCGPlayerFinish, { label: string; price: (card: CardDetails) => number | undefined }> = {
  nonfoil: { label: 'TCGPlayer', price: (card) => card.prices.usd },
  foil: { label: 'TCGPlayer (Foil)', price: (card) => card.prices.usd_foil },
  etched: { label: 'TCGPlayer (Etched)', price: (card) => card.prices.usd_etched },
};

interface PurchaseProps {
  card: CardDetails;
  finish?: TCGPlayerFinish;
}

/**
 * TCGPlayer has no finish-specific deep link, so every finish points at the same product
 * page and only the label and price differ.
 */
const TCGPlayerButton: React.FC<PurchaseProps> = ({ card, finish = 'nonfoil' }) => {
  const { label, price } = FINISHES[finish];
  const value = price(card);

  return (
    <Button
      type="link"
      outline
      color="accent"
      block
      href={getTCGLink(detailsToCard(card))}
      target="_blank"
      onClick={() => trackEvent('affiliate_click', { vendor: 'tcgplayer', scope: 'single', cards_value: value ?? 0 })}
    >
      <Flexbox direction="row" justify="between" className="w-full">
        <Text semibold>{label}</Text>
        {!!value && <Text semibold>{`$${value.toFixed(2)}`}</Text>}
      </Flexbox>
    </Button>
  );
};

export default TCGPlayerButton;
