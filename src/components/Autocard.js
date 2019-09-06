import React from 'react';

const Autocard = ({ display_image, image_flip, tags }) => (
  <a
    href="#"
    className="autocard"
    card={display_image}
    card_flip={image_flip}
    card_tags={tags}
  >
    <img
      className="activateContextModal defaultCardImage"
      src={display_image}
      alt={name}
      width={150}
      height={210}
    />
  </a>
);

export default Autocard;
