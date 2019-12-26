import React, { useCallback, useContext } from 'react';

import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';
import ImageFallback from './ImageFallback';
import withAutocard from './WithAutocard';

const AutocardLink = withAutocard('a');

const AutocardImage = (props) => {
  const { index, display_image, image_normal, image_flip, tags, finish } = props;
  const { showCustomImages } = useContext(DisplayContext.Context);
  const openCardModal = useContext(CardModalContext);
  const handleClick = useCallback(
    (event) => {
      const target = event.target;
      const index = target.getAttribute('cardindex');
      event.preventDefault();
      openCardModal(index);
    },
    [openCardModal],
  );
  return (
    <AutocardLink href="#" card={{ tags, finish, details: props }} data-index={index} onClick={handleClick}>
      <ImageFallback
        cardindex={index}
        src={showCustomImages ? display_image : image_normal}
        fallbackSrc="/content/default_card.png"
        alt={name}
        width={150}
        finish={finish}
        height={210}
      />
    </AutocardLink>
  );
};

export default AutocardImage;
