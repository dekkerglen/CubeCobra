import React, { useContext, useMemo } from 'react';

import classNames from 'classnames';

import { sortDeep } from 'utils/Sort';

import Card from '../../../datatypes/Card';
import CubeContext from '../../contexts/CubeContext';
import { ListGroup, ListGroupItem } from '../base/ListGroup';
import withCardModal from '../modals/WithCardModal';
import withGroupModal from '../modals/WithGroupModal';
import AutocardListItem from './AutocardListItem';

export interface TableViewCardGroupProps {
  cards: Card[];
  heading: React.ReactNode;
  sort?: string;
  orderedSort?: string;
  showOther?: boolean;
}

const CardModalLink = withCardModal(AutocardListItem);
const GroupModalLink = withGroupModal(ListGroupItem);

const TableViewCardGroup: React.FC<TableViewCardGroupProps> = ({
  cards,
  heading,
  sort = 'Mana Value Full',
  orderedSort = 'Alphabetical',
  showOther = false,
}) => {
  const canEdit = useContext(CubeContext)?.canEdit ?? false;
  const sorted = useMemo(() => sortDeep(cards, showOther, orderedSort, sort), [cards, showOther, orderedSort, sort]);

  return (
    <ListGroup>
      {canEdit ? (
        <GroupModalLink heading modalprops={{ cards }}>
          {heading}
        </GroupModalLink>
      ) : (
        <ListGroupItem heading>{heading}</ListGroupItem>
      )}

      {(sorted as [string, Card[]][]).map(([, group], groupIndex) =>
        group.map((card: Card, index: number) => (
          <CardModalLink
            key={index}
            card={card}
            altClick={() => {
              window.open(`/tool/card/${card.cardID}`);
            }}
            last={groupIndex === sorted.length - 1 && index === group.length - 1}
            className={classNames({
              'border-border-secondary border-t': index === 0,
            })}
            modalprops={{
              card,
            }}
          />
        )),
      )}
    </ListGroup>
  );
};

export default TableViewCardGroup;
