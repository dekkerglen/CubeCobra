import React from 'react';

const AutocardImage = ({ index, display_image, image_flip, tags }) => (
  <a
    href="#"
    className="autocard"
    card={display_image}
    card_flip={image_flip}
    card_tags={tags}
  >
    <img
      className="defaultCardImage"
      cardindex={index}
      src={display_image}
      alt={name}
      width={150}
      height={210}
      onClick={/* global */ handleContextModal}
    />
  </a>
);

export default AutocardImage;
