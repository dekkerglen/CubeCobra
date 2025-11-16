import React, { useContext, useMemo } from 'react';

import { cardName } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { sortDeep } from '@utils/sorting/Sort';
import classNames from 'classnames';

import { ListGroup, ListGroupItem } from 'components/base/ListGroup';
import AutocardListItem from 'components/card/AutocardListItem';
import CubeContext from 'contexts/CubeContext';

import withCardModal from '../modals/WithCardModal';
import withGroupModal from '../modals/WithGroupModal';

export interface TableViewCardGroupProps {
  cards: Card[];
  heading: React.ReactNode;
  sort?: string;
  orderedSort?: string;
  showOther?: boolean;
}

const CardModalLink = withCardModal(AutocardListItem);
const GroupModalLink = withGroupModal(ListGroupItem);
const GroupModalListItem = withGroupModal(AutocardListItem);

interface CollapsedCard {
  card: Card;
  duplicates: Card[];
  quantity: number;
  isLastInGroup: boolean;
  isFirstInGroup: boolean;
}

const TableViewCardGroup: React.FC<TableViewCardGroupProps> = ({
  cards,
  heading,
  sort = 'Mana Value Full',
  orderedSort = 'Alphabetical',
  showOther = false,
}) => {
  const { canEdit, cube } = useContext(CubeContext) ?? {};
  const collapseDuplicates = cube?.collapseDuplicateCards ?? false;
  const sorted = useMemo(() => sortDeep(cards, showOther, orderedSort, sort), [cards, showOther, orderedSort, sort]);

  // Collapse duplicates if enabled
  const displayCards = useMemo(() => {
    if (!collapseDuplicates) {
      return (sorted as [string, Card[]][])
        .map(([sortLabel, group], groupIndex) =>
          group.map((card, index) => ({
            card,
            duplicates: [],
            quantity: 1,
            isLastInGroup: groupIndex === sorted.length - 1 && index === group.length - 1,
            isFirstInGroup: index === 0,
            groupIndex,
          })),
        )
        .flat();
    }

    const collapsed: CollapsedCard[] = [];
    (sorted as [string, Card[]][]).forEach(([, group], groupIndex) => {
      const cardsByName = new Map<string, { card: Card; duplicates: Card[]; quantity: number }>();

      group.forEach((card) => {
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
          });
        }
      });

      const groupCards = Array.from(cardsByName.values());
      groupCards.forEach((item, index) => {
        collapsed.push({
          ...item,
          isLastInGroup: groupIndex === sorted.length - 1 && index === groupCards.length - 1,
          isFirstInGroup: index === 0,
        });
      });
    });

    return collapsed;
  }, [sorted, collapseDuplicates]);

  return (
    <ListGroup>
      {canEdit ? (
        <GroupModalLink heading modalprops={{ cards }}>
          {heading}
        </GroupModalLink>
      ) : (
        <ListGroupItem heading>{heading}</ListGroupItem>
      )}

      {displayCards.map((item, index) => {
        if (item.quantity > 1) {
          // Multiple cards with same name
          const allCards = [item.card, ...item.duplicates];

          if (canEdit) {
            // Use group modal for cubes you own
            return (
              <GroupModalListItem
                key={`${item.card.index}-group-${index}`}
                card={item.card}
                last={item.isLastInGroup}
                className={classNames('font-semibold', {
                  'border-border-secondary border-t': item.isFirstInGroup,
                })}
                modalprops={{ cards: allCards }}
                showRotoInfo
                cardCopyIndex={item.card.index!}
                appendChildren
              >
                <span className="font-semibold">×{item.quantity}</span>
              </GroupModalListItem>
            );
          } else {
            // Use regular card modal for first card in group for cubes you don't own
            return (
              <CardModalLink
                key={`${item.card.index}-group-${index}`}
                card={item.card}
                altClick={() => {
                  window.open(`/tool/card/${item.card.cardID}`);
                }}
                last={item.isLastInGroup}
                className={classNames('font-semibold', {
                  'border-border-secondary border-t': item.isFirstInGroup,
                })}
                modalprops={{
                  card: item.card,
                }}
                showRotoInfo
                cardCopyIndex={item.card.index!}
                appendChildren
              >
                <span className="font-semibold">×{item.quantity}</span>
              </CardModalLink>
            );
          }
        } else {
          // Single card - use regular card modal
          return (
            <CardModalLink
              key={`${item.card.index}-${index}`}
              card={item.card}
              altClick={() => {
                window.open(`/tool/card/${item.card.cardID}`);
              }}
              last={item.isLastInGroup}
              className={classNames({
                'border-border-secondary border-t': item.isFirstInGroup,
              })}
              modalprops={{
                card: item.card,
              }}
              showRotoInfo
              cardCopyIndex={item.card.index!}
            />
          );
        }
      })}
    </ListGroup>
  );
};

export default TableViewCardGroup;
