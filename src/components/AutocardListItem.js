import React from 'react';

import { Button } from 'reactstrap';

import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';

import Affiliate from '../util/Affiliate';

const AutocardListItem = ({ card, noCardModal, children }) => {
  let { display_image, image_normal, image_flip, name } = card.details;
  let { tags } = card;
  
  return (
    <DisplayContext.Consumer>
      {({ showCustomImages, showTagColors }) => {
        let colorClass = showTagColors ? getCardTagColorClass(card) : getCardColorClass(card);
        return (
          <CardModalContext.Consumer>
            {openCardModal => <>
              <div
                className={`card-list-item list-group-item autocard d-flex flex-row ${colorClass}`}
                card={showCustomImages ? display_image : image_normal}
                card_flip={image_flip}
                card_tags={tags}
                cardindex={card.index}
              >
                <a
                  href={noCardModal ? undefined : '#'}
                  className="d-block w-100"
                  onAuxClick={noCardModal ? undefined : e => { e.preventDefault(); if (e.button == 1) { window.open(Affiliate.getTCGLink(card)); }}}
                  onClick={noCardModal ? undefined : e => { e.preventDefault(); openCardModal(card); }}
                >
                  {name}
                </a>
                {children}
              </div>
            </>}
          </CardModalContext.Consumer>
        );
      }
      }
    </DisplayContext.Consumer>
  );
}

export default AutocardListItem;
