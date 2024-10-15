import React, { useContext, useMemo } from 'react';
import { ListGroup, ListGroupItem } from 'reactstrap';

import AutocardListItem from 'components/card/AutocardListItem';
import withCardModal from 'components/modals/WithCardModal';
import withGroupModal from 'components/modals/WithGroupModal';
import CubeContext from 'contexts/CubeContext';
import Card from 'datatypes/Card';
import { sortDeep } from 'utils/Sort';

export interface AutocardListGroupProps {
  cards: Card[];
  heading: React.ReactNode;
  sort?: string;
  orderedSort?: string;
  showOther?: boolean;
}

const CardModalLink = withCardModal(AutocardListItem);
const GroupModalLink = withGroupModal(ListGroupItem);

const AutocardListGroup: React.FC<AutocardListGroupProps> = ({
  cards,
  heading,
  sort = 'Mana Value Full',
  orderedSort = 'Alphabetical',
  showOther = false,
}) => {
  const canEdit = useContext(CubeContext)?.canEdit ?? false;
  const sorted = useMemo(() => sortDeep(cards, showOther, orderedSort, sort), [cards, showOther, orderedSort, sort]);

  return (
    <ListGroup className="list-outline">
      {canEdit ? (
        <GroupModalLink tag="div" className="list-group-heading" modalprops={{ cards }}>
          {heading}
        </GroupModalLink>
      ) : (
        <ListGroupItem tag="div" className="list-group-heading" modalprops={{ cards }}>
          {heading}
        </ListGroupItem>
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

export default AutocardListGroup;
