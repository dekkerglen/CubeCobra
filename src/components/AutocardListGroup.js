import React from 'react';

import { Col, ListGroup, ListGroupItem, Row } from 'reactstrap';

import AutocardListItem from './AutocardListItem';
import GroupModalContext from './GroupModalContext';

const alphaCompare = (a, b) => {
  const textA = a.details.name.toUpperCase();
  const textB = b.details.name.toUpperCase();
  return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
};

const AutocardListGroup = ({ cards, heading, primary, secondary, tertiary }) => {
  const groups = sortIntoGroups(cards, tertiary);
  return (
    <ListGroup className="list-outline">
      <GroupModalContext.Consumer>
        {({ openGroupModal, setGroupModalCards }) =>
          <ListGroupItem
            tag="a"
            href="#"
            className="list-group-heading"
            onClick={e => { e.preventDefault(); setGroupModalCards(cards); openGroupModal(); }}
            primarysort={primary}
            secondarysort={secondary}
            tertiarysort={tertiary}
          >
            {heading}
          </ListGroupItem>
        }
      </GroupModalContext.Consumer>
      {getLabels(tertiary).filter(cmc => groups[cmc]).map(cmc =>
        <Row key={cmc} noGutters className="cmc-group">
          <Col>
            {groups[cmc].sort(alphaCompare).map(card =>
              <AutocardListItem key={card.details.name} card={card} />
            )}
          </Col>
        </Row>
      )}
    </ListGroup>
  );
}

AutocardListGroup.defaultProps = {
  primary: 'Color Category',
  secondary: 'Types-Multicolor',
  tertiary: 'CMC-Full',
};

export default AutocardListGroup;
