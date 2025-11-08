import React, { useMemo } from 'react';

import { Flexbox } from 'components/base/Layout';
import { tcgMassEntryUrl, tcgplayerAffiliate } from 'utils/Affiliate';
import { cardIsToken, cardName, cardPrice } from '@utils/cardutil';

import Card from '@utils/datatypes/Card';
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

const TCGPlayerBulkButton: React.FC<MassBuyButtonProps> = ({ cards }) => {
  const formRef = React.useRef<HTMLFormElement>(null);

  const formData = {
    c: cards
      .map(getEntry)
      .filter((x): x is string => x !== null)
      .join('||'),
    affiliateurl: tcgplayerAffiliate,
  };

  const price = useMemo(() => cards.reduce((acc, card) => acc + (cardPrice(card) ?? 0), 0), [cards]);

  return (
    <Form method="POST" action={tcgMassEntryUrl} formData={formData} ref={formRef}>
      <Button block outline color="accent" onClick={() => formRef.current?.submit()}>
        <Flexbox direction="row" justify="between" className="w-full">
          <Text semibold>TCGPlayer</Text>
          {price > 0 && <Text semibold>{`$${price.toFixed(2)}`}</Text>}
        </Flexbox>
      </Button>
    </Form>
  );
};

export default TCGPlayerBulkButton;
