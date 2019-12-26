import React from 'react';

import { Button } from 'reactstrap';

import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';
import TagContext from './TagContext';
import withAutocard from './WithAutocard';

import Affiliate from '../util/Affiliate';

const AutocardDiv = withAutocard('div');

function handleAuxEvent(event, card) {
  if (event.button == 1) {
    window.open('/tool/card/' + card.details._id);
  }
}

const AutocardListItemRaw = ({ card, noCardModal, cardColorClass, openCardModal, children }) => {
  let { display_image, image_normal, image_flip, name } = card.details;
  let { tags } = card;

  return (
    <AutocardDiv
      className={`card-list-item list-group-item autocard d-flex flex-row ${cardColorClass(card)}`}
      card={card}
      cardindex={card.index}
    >
      <a
        href={noCardModal ? undefined : '#'}
        className="d-block w-100"
        onAuxClick={
          noCardModal
            ? undefined
            : (e) => {
                e.preventDefault();
                handleAuxEvent(e, card);
              }
        }
        onClick={
          noCardModal
            ? undefined
            : (e) => {
                e.preventDefault();
                openCardModal(card.index);
              }
        }
      >
        {name}
      </a>
      {children}
    </AutocardDiv>
  );
};

const AutocardListItem = (props) => (
  <TagContext.Consumer>
    {({ cardColorClass }) => (
      <CardModalContext.Consumer>
        {(openCardModal) => (
          <AutocardListItemRaw cardColorClass={cardColorClass} openCardModal={openCardModal} {...props} />
        )}
      </CardModalContext.Consumer>
    )}
  </TagContext.Consumer>
);

export default AutocardListItem;
