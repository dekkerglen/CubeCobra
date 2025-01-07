import Button from './base/Button';
import Form from './Form';
import Card from '../datatypes/Card';
import React from 'react';
import { tcgMassEntryUrl, tcgplayerAffiliate } from 'utils/Affiliate';
import { cardIsToken, cardName } from 'utils/Card';

interface MassBuyButtonProps {
  cards: Card[];
  [key: string]: any; // To allow any additional props
  children: React.ReactNode;
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

const MassBuyButton: React.FC<MassBuyButtonProps> = ({ cards, children }) => {
  const formRef = React.useRef<HTMLFormElement>(null);

  const formData = {
    c: cards
      .map(getEntry)
      .filter((x): x is string => x !== null)
      .join('||'),
    affiliateurl: tcgplayerAffiliate,
  };

  return (
    <Form method="POST" action={tcgMassEntryUrl} formData={formData} ref={formRef}>
      <Button block color="primary" onClick={() => formRef.current?.submit()}>
        {children}
      </Button>
    </Form>
  );
};

export default MassBuyButton;
