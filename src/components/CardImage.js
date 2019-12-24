import React from 'react';

import DisplayContext from './DisplayContext';
import ImageFallback from './ImageFallback';
import withAutocard from './WithAutocard';

const ImageAutocard = withAutocard(ImageFallback);

const CardImage = ({ card, noAutocard, className, ...props }) => {
  const Tag = noAutocard ? ImageFallback : ImageAutocard;
  return (
    <Tag
      card={card}
      src={card.imgUrl || card.details.image_normal}
      fallbackSrc="/content/default_card.png"
      alt={card.details.name}
      width="100%"
      className={className ? className + ' card-border' : 'card-border'}
      {...props}
    />
  );
};

export default CardImage;
