import React, { useCallback, useContext } from 'react';
import PropTypes from 'prop-types';

import { ListGroup, ListGroupItem } from 'reactstrap';

import { sortDeep } from 'utils/Sort';

import AutocardListItem from 'components/AutocardListItem';
import CubeContext from 'components/CubeContext';
import GroupModalContext from 'components/GroupModalContext';

const AutocardListGroup = ({ cards, heading, sort, rowTag, noGroupModal }) => {
  const RowTag = rowTag;
  const sorted = sortDeep(cards, sort);
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
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
  rowTag: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  noGroupModal: PropTypes.bool,
  heading: PropTypes.node.isRequired,
  sort: PropTypes.string,
};

AutocardListGroup.defaultProps = {
  rowTag: AutocardListItem,
  noGroupModal: false,
  sort: 'CMC-Full',
};

export default AutocardListGroup;
