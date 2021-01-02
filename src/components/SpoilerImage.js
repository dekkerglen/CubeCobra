import React, { useCallback, useContext } from 'react';

import CardModalContext from 'contexts/CardModalContext';
import FoilCardImage from 'components/FoilCardImage';
import CardPropType from 'proptypes/CardPropType';

const SpoilerImage = ({ card }) => {
  const openCardModal = useContext(CardModalContext);
  const handleClick = useCallback(() => openCardModal(card), [openCardModal, card]);
  return <FoilCardImage autocard card={card} onClick={handleClick} className="clickable" />;
};

SpoilerImage.propTypes = {
  card: CardPropType.isRequired,
};

export default SpoilerImage;
