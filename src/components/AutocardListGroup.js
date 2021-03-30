import React, { useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import { ListGroup, ListGroupItem } from 'reactstrap';

import { sortDeep } from 'utils/Sort';

import AutocardListItem from 'components/AutocardListItem';
import CubeContext from 'contexts/CubeContext';
import GroupModalContext from 'contexts/GroupModalContext';

const AutocardListGroup = ({ cards, heading, sort, orderedSort, showOther, rowTag, noGroupModal }) => {
  const RowTag = rowTag;
  const sorted = sortDeep(cards, showOther, orderedSort, sort);
  const { canEdit } = useContext(CubeContext);
  const { openGroupModal, setGroupModalCards } = useContext(GroupModalContext);
  const canGroupModal = !noGroupModal && canEdit;
  const handleClick = useCallback(
    (event) => {
      event.preventDefault();
      setGroupModalCards(cards);
      openGroupModal();
    },
    [cards, openGroupModal, setGroupModalCards],
  );
  return (
    <ListGroup className="list-outline">
      <ListGroupItem
        tag="div"
        className={`list-group-heading${canGroupModal ? ' clickable' : ''}`}
        onClick={canGroupModal ? handleClick : undefined}
      >
        {heading}
      </ListGroupItem>
      {sorted.map(([, group]) =>
        group.map((card, index) => (
          <RowTag
            key={card._id || (typeof card.index === 'undefined' ? index : card.index)}
            card={card}
            className={index === 0 ? 'cmc-group' : undefined}
          />
        )),
      )}
    </ListGroup>
  );
};

AutocardListGroup.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  rowTag: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  noGroupModal: PropTypes.bool,
  heading: PropTypes.node.isRequired,
  sort: PropTypes.string,
  orderedSort: PropTypes.string,
  showOther: PropTypes.bool,
};

AutocardListGroup.defaultProps = {
  rowTag: AutocardListItem,
  noGroupModal: false,
  sort: 'CMC-Full',
  orderedSort: 'Alphabetical',
  showOther: false,
};

export default AutocardListGroup;
