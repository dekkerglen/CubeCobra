import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import { classes } from '../util/Util';

import DisplayContext from './DisplayContext';
import ImageFallback from './ImageFallback';
import withAutocard from './WithAutocard';

const ImageAutocard = withAutocard(ImageFallback);

const CardImage = ({ card, autocard, className, ...props }) => {
  const { showCustomImages } = useContext(DisplayContext);

  if (!card) {
    card = CardImage.defaultCard;
  }

  const imageSrc = (showCustomImages && card.imgUrl) || card.details.image_normal;
  const Tag = autocard ? ImageAutocard : ImageFallback;
  return (
    <Tag
      card={autocard ? card : undefined}
      src={imageSrc}
      fallbackSrc="/content/default_card.png"
      alt={card.details.name}
      width="100%"
      className={classes('card-border', className)}
      {...props}
    />
  );
};

CardImage.defaultCard = {
  colors: [],
  tags: [],
  details: {
    image_normal: '/content/default_card.png',
  },
};

CardImage.propTypes = {
  card: PropTypes.shape({
    imgUrl: PropTypes.string,
    details: PropTypes.shape({
      name: PropTypes.string.isRequired,
      image_normal: PropTypes.string.isRequired,
    }).isRequired,
  }),
  autocard: PropTypes.bool,
  className: PropTypes.string,
};

CardImage.defaultProps = {
  card: CardImage.defaultCard,
};

export default CardImage;
