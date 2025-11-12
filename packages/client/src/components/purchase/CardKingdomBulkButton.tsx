import React, { useMemo } from 'react';

import { cardIsToken, cardName, cardPriceCardKingdom } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';

import { Flexbox } from 'components/base/Layout';
import { cardKingdomBulkLink } from 'utils/Affiliate';

import Button from '../base/Button';
import Text from '../base/Text';
import Form from '../Form';

interface MassBuyButtonProps {
  cards: Card[];
}

const getEntry = (card: Card): string | null => {
  if (cardIsToken(card)) {
    return `1 ${cardName(card)} Token`;
  }
  if (cardName(card).endsWith('Emblem')) {
    return `1 Emblem - ${cardName(card).replace(' Emblem', '')}`;
  }
  return `1 ${cardName(card)}`;
};

const CardKingdomBulkButton: React.FC<MassBuyButtonProps> = ({ cards }) => {
  const formRef = React.useRef<HTMLFormElement>(null);

  const formData = {
    c: cards
      .map(getEntry)
      .filter((x): x is string => x !== null)
      .join('||'),
  };

  const price = useMemo(() => cards.reduce((acc, card) => acc + (cardPriceCardKingdom(card) ?? 0), 0), [cards]);

  return (
    <Form method="POST" action={cardKingdomBulkLink} formData={formData} ref={formRef}>
      <Button block outline color="accent" onClick={() => formRef.current?.submit()}>
        <Flexbox direction="row" justify="between" className="w-full">
          <Text semibold>Card Kingdom</Text>
          {price > 0 && <Text semibold>{`$${price.toFixed(2)}`}</Text>}
        </Flexbox>
      </Button>
    </Form>
  );
};

export default CardKingdomBulkButton;
