import React, { useContext, forwardRef } from 'react';

import DisplayContext from './DisplayContext';

/* HOC to add autocard to another element */

const handleMouseOver = (event) => {
  const target = event.currentTarget;
  const front = target.getAttribute('data-front');
  const back = target.getAttribute('data-back');
  const tags = JSON.parse(target.getAttribute('data-tags') || '[]');
  const foil = target.getAttribute('data-foil') === 'true';
  const inModal = target.getAttribute('data-in-modal') === 'true';
  if (!stopAutocard) {
    /* global */
    autocard_show_card(front, back, false, tags.length > 0 ? tags : null, foil, inModal);
  }
};

const handleMouseOut = (event) => /* global */ autocard_hide_card();

const withAutocard = (Tag) =>
  forwardRef(({ card, front, back, tags, inModal, ...props }, ref) => {
    const { showCustomImages } = useContext(DisplayContext);
    card = card || { details: {} };
    tags = tags || card.tags || [];
    front = front || (showCustomImages && card.imgUrl) || card.details.image_normal;
    back = back || card.details.image_flip;
    return (
      <Tag
        cardid={card.cardID}
        ref={ref}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        data-front={front}
        data-back={back}
        data-tags={JSON.stringify(tags)}
        data-foil={card.finish === 'Foil'}
        data-in-modal={!!inModal}
        {...props}
      />
    );
  });

export default withAutocard;
