import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import DisplayContext from './DisplayContext';
import ImageFallback from './ImageFallback';
import withAutocard from './WithAutocard';

const ImageAutocard = withAutocard(ImageFallback);

const CardImage = ({ card, noAutocard, className, ...props }) => {
  const { showCustomImages } = useContext(DisplayContext);
  const imageSrc = (showCustomImages && card.imgUrl) || card.details.image_normal;
  const Tag = noAutocard ? ImageFallback : ImageAutocard;
  return (
    <Tag
      card={noAutocard ? undefined : card}
      src={imageSrc}
      fallbackSrc="/content/default_card.png"
      alt={card.details.name}
      width="100%"
      className={className ? className + ' card-border' : 'card-border'}
      {...props}
    />
  );
};

CardImage.propTypes = {
  card: PropTypes.shape({
    imgUrl: PropTypes.string,
    details: PropTypes.shape({
      name: PropTypes.string.isRequired,
      image_normal: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  noAutocard: PropTypes.bool,
  className: PropTypes.string,
};

export default CardImage;
