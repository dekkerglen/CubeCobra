import React, { useMemo } from 'react';

import { Flexbox } from 'components/base/Layout';
import { getBulkManaPoolLink } from 'utils/Affiliate';
import { cardPriceManaPool } from '@utils/cardutil';

import Card from '@utils/datatypes/Card';
import Button from '../base/Button';
import Text from '../base/Text';

interface MassBuyButtonProps {
  cards: Card[];
}

const ManaPoolBulkButton: React.FC<MassBuyButtonProps> = ({ cards }) => {
  const price = useMemo(() => cards.reduce((acc, card) => acc + (cardPriceManaPool(card) ?? 0), 0), [cards]);

  return (
    <Button type="link" block outline color="accent" href={getBulkManaPoolLink(cards)}>
      <Flexbox direction="row" justify="between" className="w-full">
        <Text semibold>Mana Pool</Text>
        {price > 0 && <Text semibold>{`$${price.toFixed(2)}`}</Text>}
      </Flexbox>
    </Button>
  );
};

export default ManaPoolBulkButton;
