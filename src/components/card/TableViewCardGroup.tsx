import React, { useContext, useMemo } from 'react';

import AutocardListItem from 'components/card/AutocardListItem';
import withCardModal from 'components/modals/WithCardModal';
import withGroupModal from 'components/modals/WithGroupModal';
import CubeContext from 'contexts/CubeContext';
import Card from 'datatypes/Card';
import { sortDeep } from 'utils/Sort';
import { ListGroup, ListGroupItem } from 'components/base/ListGroup';

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
        <GroupModalLink modalprops={{ cards }}>{heading}</GroupModalLink>
      ) : (
        <ListGroupItem>{heading}</ListGroupItem>
      )}

      {(sorted as [string, Card[]][]).map(([, group]) =>
        group.map((card: Card, index: number) => (
          <CardModalLink
            key={card.index}
            card={card}
            altClick={() => {
              window.open(`/tool/card/${card.cardID}`);
            }}
            className={index === 0 ? 'cmc-group' : undefined}
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
