import React, { useContext } from 'react';

import DisplayContext from './DisplayContext';

/* HOC to add autocard to another element */

const handleMouseOver = (event) => {
  const target = event.currentTarget;
  const front = target.getAttribute('data-front');
  const back = target.getAttribute('data-back');
  const tags = JSON.parse(target.getAttribute('data-tags') || '[]');
  const foil = target.getAttribute('data-foil') === 'true';
  /* global */
  autocard_show_card(front, back, false, tags.length > 0 ? tags : null, foil);
};

const handleMouseOut = (event) => /* global */ autocard_hide_card();

const withAutocard = (Tag) => ({ card, front, back, ...props }) => {
  const { showCustomImages } = useContext(DisplayContext.Context);
  card = card || { details: {} };
  const tags = card.tags || [];
  front = front || (showCustomImages ? card.imgUrl || card.details.display_image : false) || card.details.image_normal;
  back = back || card.details.image_flip;
  return (
    <Tag
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      data-front={front}
      data-back={back}
      data-tags={JSON.stringify(tags)}
      data-foil={card.finish==='Foil'}
      {...props}
    />
  );
};

export default withAutocard;
