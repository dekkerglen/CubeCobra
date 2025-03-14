import React from 'react';

import classNames from 'classnames';

import { cardId, cardName, getCardColorClass } from 'utils/cardutil';

import CardType from '../../../datatypes/Card';
import withAutocard from '../WithAutocard';
import { Flexbox } from './Layout';

const AutocardItem = withAutocard('div');

interface CardListProps {
  cards: CardType[];
  label?: string;
}

const CardList: React.FC<CardListProps> = ({ cards }) => {
  return (
    <Flexbox direction="col" className="border border-border-secondary rounded-md">
      <div className="overflow-y-auto max-h-1/2">
        {cards.map((card, index) => (
          <AutocardItem
            key={cardId(card)}
            card={card}
            className={classNames(`bg-card-${getCardColorClass(card)}`, 'px-2 py-0.5 truncate text-sm', {
              'rounded-t-md': index === 0,
              'rounded-b-md': index === cards.length - 1,
              'border-t border-border-secondary': index !== 0,
            })}
          >
            {cardName(card)}
          </AutocardItem>
        ))}
      </div>
    </Flexbox>
  );
};

export default CardList;
