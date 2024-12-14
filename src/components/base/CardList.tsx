import classNames from 'classnames';
import withAutocard from 'components/WithAutocard';
import CardType from 'datatypes/Card';
import React from 'react';
import { cardId, cardName } from 'utils/Card';
import { getCardColorClass } from 'utils/Util';
import { Flexbox } from './Layout';

const AutocardItem = withAutocard('div');

interface CardListProps {
  cards: CardType[];
  label?: string;
}

const CardList: React.FC<CardListProps> = ({ cards }) => {
  return (
    <Flexbox direction="col" className="border border-border-secondary rounded-md">
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
    </Flexbox>
  );
};

export default CardList;
