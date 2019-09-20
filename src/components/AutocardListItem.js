import React from 'react';

import { Button } from 'reactstrap';

import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';

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
