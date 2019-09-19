import React from 'react';

import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';

const AutocardListItem = ({ card }) => {
  let { display_image, image_normal, image_flip, name } = card.details;
  let { tags } = card;
  return (
    <DisplayContext.Consumer>
      {({ showCustomImages, showTagColors }) => {
        let colorClass = showTagColors ? getCardTagColorClass(card) : getCardColorClass(card);
        return (
          <CardModalContext.Consumer>
            {openCardModal =>
              <a
                href="#"
                className={`card-list-item list-group-item autocard ${colorClass}`}
                card={showCustomImages ? display_image : image_normal}
                card_flip={image_flip}
                card_tags={tags}
                cardindex={card.index}
                onClick={e => { e.preventDefault(); openCardModal(card); }}
              >
                {name}
              </a>
            }
          </CardModalContext.Consumer>
        );
      }
      }
    </DisplayContext.Consumer>
  );
}

export default AutocardListItem;
