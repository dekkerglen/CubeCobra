import React from 'react';

import FoilCardImage from 'components/FoilCardImage';
import CardPropType from 'proptypes/CardPropType';

function SpoilerImage({ card, ...props }) {
  return <FoilCardImage autocard card={card} {...props} className="clickable" />;
}

SpoilerImage.propTypes = {
  card: CardPropType.isRequired,
};

export default SpoilerImage;
