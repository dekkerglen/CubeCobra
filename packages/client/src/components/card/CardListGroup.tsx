import React from 'react';

import Card from '@utils/datatypes/Card';

import { ListGroup, ListGroupItem } from '../base/ListGroup';
import AutocardListItem from './AutocardListItem';

export interface CardListGroupProps {
  cards: Card[];
  heading: string;
  onClick?: (index: number) => void;
  selectedIndex?: number;
}

const CardListGroup: React.FC<CardListGroupProps> = ({ cards, heading, onClick, selectedIndex }) => {
  return (
    <ListGroup>
      <ListGroupItem heading>{heading}</ListGroupItem>
      {cards.map((card: Card, index: number) => (
        <AutocardListItem
          key={card.index}
          card={card}
          onClick={() => onClick?.(index)}
          last={index === cards.length - 1}
          isSelected={index === selectedIndex}
        />
      ))}
    </ListGroup>
  );
};

export default CardListGroup;
