import React from 'react';

const Autocard = ({ image_normal, image_flip, tags }) => (
  <a
    href="#"
    className="autocard"
    card={image_normal}
    card_flip={image_flip}
    card_tags={tags}
  >
    <img
      className="activateContextModal"
      src={image_normal}
      alt={name}
      width={150}
      height={210}
    />
  </a>
);

export default Autocard;
