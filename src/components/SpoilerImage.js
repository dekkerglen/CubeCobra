import React, { useCallback, useContext } from 'react';

import CardImage from './CardImage';
import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';
import FoilOverlay from './FoilOverlay';

const FoilCardImage = FoilOverlay(CardImage);

const SpoilerImage = ({ index, tags, finish, ...props }) => {
  const openCardModal = useContext(CardModalContext);
  const handleClick = useCallback(
    (event) => {
      const target = event.target;
      const index = target.getAttribute('data-index');
      event.preventDefault();
      openCardModal(/* global */ cube[index]);
    },
    [openCardModal],
  );
  const card = { tags, finish, details: props };
  return <FoilCardImage card={card} data-index={index} onClick={handleClick} />;
};

export default SpoilerImage;
