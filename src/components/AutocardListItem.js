import React from 'react';

import DisplayContext from './DisplayContext';

const AutocardListItem = ({ card }) => {
  let { display_image, image_normal, image_flip, name } = card.details;
  let { tags } = card;
  let color_class = (show_tag_colors) ? getCardTagColorClass(card) : getCardColorClass(card);
  return (
    <DisplayContext.Consumer>
      {({ showCustomImages }) =>
        <a
          href="#"
          className={`card-list-item list-group-item autocard ${color_class}`}
          card={showCustomImages ? display_image : image_normal}
          card_flip={image_flip}
          card_tags={tags}
          cardindex={card.index}
          onClick={/* global */ handleContextModal}
        >
          {name}
        </a>
      }
    </DisplayContext.Consumer>
  );
}

export default AutocardListItem;
