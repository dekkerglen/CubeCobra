import React from 'react';

import { getTCGLink } from 'utils/Affiliate';
import { detailsToCard } from 'utils/cardutil';

import { CardDetails } from '../../../datatypes/Card';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

interface PurchaseProps {
  card: CardDetails;
}

const TCGPlayerButton: React.FC<PurchaseProps> = ({ card }) => {
  return (
    <Button type="link" outline color="accent" block href={getTCGLink(detailsToCard(card))} target="_blank">
      <Flexbox direction="row" justify="between" className="w-full">
        <Text semibold>TCGPlayer</Text>
        {card.prices.usd && <Text semibold>{`$${card.prices.usd.toFixed(2)}`}</Text>}
      </Flexbox>
    </Button>
  );
};

export default TCGPlayerButton;
