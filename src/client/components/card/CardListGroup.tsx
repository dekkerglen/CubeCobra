import React from 'react';

import { ListGroup, ListGroupItem } from '../base/ListGroup';
import AutocardListItem from './AutocardListItem';
import Card from '../../../datatypes/Card';

export interface CardListGroupProps {
  cards: Card[];
  heading: React.ReactNode;
  onClick?: (index: number) => void;
}

const CardListGroup: React.FC<CardListGroupProps> = ({ cards, heading, onClick }) => {
  return (
    <ListGroup>
      <ListGroupItem heading>{heading}</ListGroupItem>
      {cards.map((card: Card, index: number) => (
        <AutocardListItem
          key={card.index}
          card={card}
          onClick={() => onClick?.(index)}
          last={index === cards.length - 1}
        />
      ))}
    </ListGroup>
  );
};

export default CardListGroup;
