import React from 'react';

import { Col, ListGroup, ListGroupItem, Row } from 'reactstrap';

import AutocardListItem from './AutocardListItem';
import GroupModalContext from './GroupModalContext';

const alphaCompare = (a, b) => {
  const textA = a.details.name.toUpperCase();
  const textB = b.details.name.toUpperCase();
  return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
};

const AutocardListGroup = ({ cards, heading, sort }) => {
  const groups = sortIntoGroups(cards, sort);
  return (
    <ListGroup className="list-outline">
      <GroupModalContext.Consumer>
        {({ openGroupModal, setGroupModalCards }) =>
          <ListGroupItem
            tag="a"
            href="#"
            className="list-group-heading"
            onClick={e => { e.preventDefault(); setGroupModalCards(cards); openGroupModal(); }}
          >
            {heading}
          </ListGroupItem>
        }
      </GroupModalContext.Consumer>
      {getLabels(sort).filter(cmc => groups[cmc]).map(cmc =>
        <Row key={cmc} noGutters className="cmc-group">
          <Col>
            {groups[cmc].sort(alphaCompare).map(card =>
              <AutocardListItem
                key={typeof card.index === 'undefined' ? card.details.name : card.index}
                card={card}
              />
            )}
          </Col>
        </Row>
      )}
    </ListGroup>
  );
}

AutocardListGroup.defaultProps = {
  sort: 'CMC-Full',
};

export default AutocardListGroup;
