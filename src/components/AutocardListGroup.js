import React from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import { ListGroup, ListGroupItem } from 'reactstrap';

import { sortDeep } from 'utils/Sort';

import AutocardListItem from 'components/AutocardListItem';

import withCardModal from 'components/WithCardModal';
import withGroupModal from 'components/WithGroupModal';

const CardModalLink = withCardModal(AutocardListItem);
const GroupModalLink = withGroupModal(ListGroupItem);

const AutocardListGroup = ({ cards, heading, sort, orderedSort, showOther }) => {
  const sorted = sortDeep(cards, showOther, orderedSort, sort);

  return (
    <ListGroup className="list-outline">
      <GroupModalLink tag="div" className="list-group-heading" modalProps={{ cards }}>
        {heading}
      </GroupModalLink>
      {sorted.map(([, group]) =>
        group.map((card, index) => (
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

AutocardListGroup.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  heading: PropTypes.node.isRequired,
  sort: PropTypes.string,
  orderedSort: PropTypes.string,
  showOther: PropTypes.bool,
};

AutocardListGroup.defaultProps = {
  sort: 'Mana Value Full',
  orderedSort: 'Alphabetical',
  showOther: false,
};

export default AutocardListGroup;
