import React, { useMemo, useContext } from 'react';
import Card from 'datatypes/Card';
import { ListGroup, ListGroupItem } from 'reactstrap';
import { sortDeep } from 'utils/Sort';
import AutocardListItem from 'components/AutocardListItem';
import withCardModal from 'components/WithCardModal';
import withGroupModal from 'components/WithGroupModal';
import CubeContext from 'contexts/CubeContext';

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
        <GroupModalLink tag="div" className="list-group-heading" modalProps={{ cards }}>
          {heading}
        </GroupModalLink>
      ) : (
        <ListGroupItem tag="div" className="list-group-heading" modalProps={{ cards }}>
          {heading}
        </ListGroupItem>
      )}

      {sorted.map(([, group]) =>
        group.map((card: Card, index: number) => (
          <CardModalLink
            key={card.index}
            card={card}
            altClick={() => {
              window.open(`/tool/card/${card.cardID}`);
            }}
            className={index === 0 ? 'cmc-group' : undefined}
            modalProps={{
              card,
            }}
          />
        )),
      )}
    </ListGroup>
  );
};

export default AutocardListGroup;
