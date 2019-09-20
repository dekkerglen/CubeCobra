import React from 'react';

import { Col, ListGroup, ListGroupItem, Row } from 'reactstrap';

import AutocardListItem from './AutocardListItem';
import GroupModalContext from './GroupModalContext';

const AutocardListGroup = ({ cards, heading, primary, secondary, tertiary }) => {
  let groups = sortIntoGroups(cards, "CMC");
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
      {
        getLabels("CMC").filter(cmc => groups[cmc]).map(cmc => (
          <Row key={cmc} noGutters className="cmc-group">
            <Col>
              {
                groups[cmc].map(card =>
                  (<AutocardListItem key={card.details.name} card={card} />)
                )
              }
            </Col>
          </Row>
        ))
      }
    </ListGroup>
  );
}

export default AutocardListGroup;
