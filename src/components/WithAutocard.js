import React, { useContext, forwardRef } from 'react';

import DisplayContext from './DisplayContext';

/* HOC to add autocard to another element */

const handleMouseOver = (event) => {
  const target = event.currentTarget;
  const front = target.getAttribute('data-front');
  const back = target.getAttribute('data-back');
  const tags = JSON.parse(target.getAttribute('data-tags') || '[]');
  const foil = target.getAttribute('data-foil') === 'true';
  /* global */
  if (!stopAutocard) {
    autocard_show_card(front, back, false, tags.length > 0 ? tags : null, foil);
  }
};

const handleMouseOut = (event) => /* global */ autocard_hide_card();

const withAutocard = (Tag) =>
  forwardRef(({ card, front, back, tags, ...props }, ref) => {
    const { showCustomImages } = useContext(DisplayContext.Context);
    card = card || { details: {} };
    tags = tags || card.tags || [];
    front =
      front || (showCustomImages ? card.imgUrl || card.details.display_image : false) || card.details.image_normal;
    back = back || card.details.image_flip;
    return (
      <Tag
        ref={ref}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        data-front={front}
        data-back={back}
        data-tags={JSON.stringify(tags)}
        data-foil={card.finish === 'Foil'}
        {...props}
      />
    );
  });

export default withAutocard;
