import React from 'react';

const AutocardListItem = card => {
  let { image_normal, image_flip, name, tags } = card.details;
  return (
    <a
      href="#"
      className={`activateContextModal card-list-item list-group-item autocard ${getCardColorClass(card)}`}
      card={image_normal}
      card_flip={image_flip}
      card_tags={tags}
    >
      {name}
    </a>
  );
}

export default AutocardListItem;
