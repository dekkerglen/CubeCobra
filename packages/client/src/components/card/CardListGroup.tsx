import React, { useContext, useMemo } from 'react';

import { cardName } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';

import CubeContext from 'contexts/CubeContext';

import { ListGroup, ListGroupItem } from '../base/ListGroup';
import AutocardListItem from './AutocardListItem';
import withGroupModal from '../modals/WithGroupModal';

const GroupModalListItem = withGroupModal(AutocardListItem);

export interface CardListGroupProps {
  cards: Card[];
  heading: string;
  onClick?: (index: number) => void;
  selectedIndex?: number;
  collapseDuplicates?: boolean;
}

interface CollapsedCard {
  card: Card;
  duplicates: Card[];
  quantity: number;
}

const CardListGroup: React.FC<CardListGroupProps> = ({
  cards,
  heading,
  onClick,
  selectedIndex,
  collapseDuplicates: collapseDuplicatesProp,
}) => {
  const { cube, canEdit } = useContext(CubeContext);
  const collapseDuplicates = collapseDuplicatesProp ?? cube?.collapseDuplicateCards ?? false;

  const displayCards = useMemo(() => {
    if (!collapseDuplicates) {
      return cards.map((card, index) => ({
        card,
        duplicates: [],
        quantity: 1,
        originalIndex: index,
      }));
    }

    const cardsByName = new Map<string, CollapsedCard & { originalIndex: number }>();

    cards.forEach((card, index) => {
      const name = cardName(card);
      const existing = cardsByName.get(name);

      if (existing) {
        existing.duplicates.push(card);
        existing.quantity++;
      } else {
        cardsByName.set(name, {
          card,
          duplicates: [],
          quantity: 1,
          originalIndex: index,
        });
      }
    });

    return Array.from(cardsByName.values());
  }, [cards, collapseDuplicates]);

  return (
    <ListGroup>
      <ListGroupItem heading>{heading}</ListGroupItem>
      {displayCards.map((item, displayIndex) => {
        const isLast = displayIndex === displayCards.length - 1;
        const isSelected = selectedIndex !== undefined && item.originalIndex === selectedIndex;

        if (item.quantity > 1) {
          // Multiple cards with same name
          const allCards = [item.card, ...item.duplicates];

          if (canEdit) {
            // Use group modal for cubes you own
            return (
              <GroupModalListItem
                key={`${item.card.index}-group`}
                card={item.card}
                last={isLast}
                isSelected={isSelected}
                className="font-semibold"
                modalprops={{ cards: allCards }}
                appendChildren
              >
                <span className="font-semibold">×{item.quantity}</span>
              </GroupModalListItem>
            );
          } else {
            // Use regular click handler for first card in group for cubes you don't own
            return (
              <AutocardListItem
                key={`${item.card.index}-group`}
                card={item.card}
                onClick={() => onClick?.(item.originalIndex)}
                last={isLast}
                isSelected={isSelected}
                className="font-semibold"
                appendChildren
              >
                <span className="font-semibold">×{item.quantity}</span>
              </AutocardListItem>
            );
          }
        } else {
          // Single card - use regular click handler
          return (
            <AutocardListItem
              key={item.card.index}
              card={item.card}
              onClick={() => onClick?.(item.originalIndex)}
              last={isLast}
              isSelected={isSelected}
            />
          );
        }
      })}
    </ListGroup>
  );
};

export default CardListGroup;
