import React from 'react';

import DisplayContext from './DisplayContext';

const AutocardImage = ({ index, display_image, image_normal, image_flip, tags }) => (
  <DisplayContext.Consumer>
    {({ showCustomImages }) =>
      <a
        href="#"
        className="autocard"
        card={showCustomImages ? display_image : image_normal}
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
    }
  </DisplayContext.Consumer>
);

export default AutocardImage;
