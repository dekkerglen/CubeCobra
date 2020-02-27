import React, { useCallback, useContext } from 'react';

import CardModalContext from './CardModalContext';
import FoilCardImage from './FoilCardImage';

const SpoilerImage = ({ card }) => {
  const openCardModal = useContext(CardModalContext);
  const handleClick = useCallback(() => openCardModal(card), [openCardModal, card.index]);
  return <FoilCardImage autocard card={card} onClick={handleClick} className="clickable" />;
};

export default SpoilerImage;
