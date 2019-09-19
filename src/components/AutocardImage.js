import React from 'react';

import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';
import ImageFallback from './ImageFallback';

const AutocardImage = ({ index, display_image, image_normal, image_flip, tags }) => (
  <DisplayContext.Consumer>
    {({ showCustomImages }) =>
      <CardModalContext.Consumer>
        {openCardModal =>
          <a
            href="#"
            className="autocard"
            card={showCustomImages ? display_image : image_normal}
            card_flip={image_flip}
            card_tags={tags}
            onClick={e => { e.preventDefault(); openCardModal(cube[index]); }}
          >
            <ImageFallback
              cardindex={index}
              src={display_image}
              fallbackSrc="/content/default_card.png"
              alt={name}
              width={150}
              height={210}
            />
          </a>
        }
      </CardModalContext.Consumer>
    }
  </DisplayContext.Consumer>
);

export default AutocardImage;
