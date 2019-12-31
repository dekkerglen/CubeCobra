import React, { useCallback, useContext } from 'react';

import { Col, ListGroup, ListGroupItem, Row } from 'reactstrap';

import { alphaCompare } from '../util/Util';

import AutocardListItem from './AutocardListItem';
import GroupModalContext from './GroupModalContext';

const AutocardListGroup = ({ cards, heading, sort }) => {
  const groups = sortIntoGroups(cards, sort);
  const { openGroupModal, setGroupModalCards } = useContext(GroupModalContext);
  const handleClick = useCallback((event) => {
    event.preventDefault();
    setGroupModalCards(cards);
    openGroupModal();
  }, [cards, openGroupModal, setGroupModalCards]);
  return (
    <ListGroup className="list-outline">
      <ListGroupItem tag="a" href="#" className="list-group-heading" onClick={handleClick}>
        {heading}
      </ListGroupItem>
      {getLabels(sort)
        .filter((cmc) => groups[cmc])
        .map((cmc) =>
          groups[cmc].sort(alphaCompare).map((card, index) => (
            <AutocardListItem
              key={typeof card.index === 'undefined' ? index : card.index}
              card={card}
              className={index === 0 ? 'cmc-group' : undefined}
            />
          ))
        )}
    </ListGroup>
  );
};

AutocardListGroup.defaultProps = {
  sort: 'CMC-Full',
};

export default AutocardListGroup;
