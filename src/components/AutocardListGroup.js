import React from 'react';

import { ListGroup, ListGroupItem } from 'reactstrap';

import AutocardListItem from './AutocardListItem';

const AutocardListGroup = ({ cards, heading }) => (
  <ListGroup className="list-outline">
    <ListGroupItem className="list-group-heading">
      {heading}
    </ListGroupItem>
    {
      cards.map(card =>
        (<AutocardListItem key={card.details.name} card={card} />)
      )
    }
  </ListGroup>
);

export default AutocardListGroup;
