import React from 'react';

import DisplayContext from './DisplayContext';
import ImageFallback from './ImageFallback';
import withAutocard from './WithAutocard';

const ImageAutocard = withAutocard(ImageFallback);

const CardImage = ({ card, ...props }) =>
  <ImageAutocard
    card={card}
    src={card.details.display_image}
    fallbackSrc="/content/default_card.png"
    alt={card.details.name}
    width="100%"
    card={card}
    {...props}
  />;

export default CardImage;
