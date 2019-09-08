import React from 'react';

const AutocardListItem = ({ card }) => {
  let { display_image, image_flip, name } = card.details;
  let { tags } = card;
  return (
    <a
      href="#"
      className={`activateContextModal card-list-item list-group-item autocard ${getCardColorClass(card)}`}
      card={display_image}
      card_flip={image_flip}
      card_tags={tags}
      cardindex={card.index}
    >
      {name}
    </a>
  );
}

export default AutocardListItem;
