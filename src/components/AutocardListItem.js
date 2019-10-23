import React from 'react';

import { Button } from 'reactstrap';

import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';
import TagContext from './TagContext';

import Affiliate from '../util/Affiliate';

function handleAuxEvent(event, card) {
  if (event.button == 1) {
    window.open(Affiliate.getTCGLink(card));
  }
}

const AutocardListItemRaw = ({ card, noCardModal, cardColorClass, showCustomImages, openCardModal, children }) => {
  let { display_image, image_normal, image_flip, name } = card.details;
  let { tags } = card;

  return (
    <div
      className={`card-list-item list-group-item autocard d-flex flex-row ${cardColorClass(card)}`}
      card={showCustomImages ? display_image : image_normal}
      card_flip={image_flip}
      card_tags={tags}
      cardindex={card.index}
    >
      <a
        href={noCardModal ? undefined : '#'}
        className="d-block w-100"
        onAuxClick={noCardModal ? undefined : e => { e.preventDefault(); handleAuxEvent(e, card) }}
        onClick={noCardModal ? undefined : e => { e.preventDefault(); openCardModal(card); }}
      >
        {name}
      </a>
      {children}
    </div>
  );
}

const AutocardListItem = props =>
  <TagContext.Consumer>
    {({ cardColorClass }) =>
      <DisplayContext.Consumer>
        {({ showCustomImages }) =>
          <CardModalContext.Consumer>
            {openCardModal =>
              <AutocardListItemRaw
                cardColorClass={cardColorClass}
                showCustomImages={showCustomImages}
                openCardModal={openCardModal}
                {...props}
              />
            }
          </CardModalContext.Consumer>
        }
      </DisplayContext.Consumer>
    }
  </TagContext.Consumer>;

export default AutocardListItem;
