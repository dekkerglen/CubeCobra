import React from 'react';

import CardPropType from 'proptypes/CardPropType';

import FoilCardImage from 'components/FoilCardImage';

const SpoilerImage = ({ card, ...props }) => {
  return <FoilCardImage autocard card={card} {...props} className="clickable" />;
};

SpoilerImage.propTypes = {
  card: CardPropType.isRequired,
};

export default SpoilerImage;
