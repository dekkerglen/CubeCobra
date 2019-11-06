import React from 'react';

/* HOC to add autocard to another element */

const handleMouseOver = event => {
  const target = event.currentTarget;
  const front = target.getAttribute('data-front');
  const back = target.getAttribute('data-back');
  const tags = JSON.parse(target.getAttribute('data-tags') || '[]');
  /* global */
  autocard_show_card(front, back, false, tags.length > 0 ? tags : null);
};

const handleMouseOut = event => /* global */ autocard_hide_card();

const withAutocard = Tag => ({ card, ...props }) => {
  const tags = card.tags || [];
  const front = card.imgUrl || card.details.image_normal;
  const back = card.details.image_flip;
  return (
    <Tag
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      data-front={front}
      data-back={back}
      data-tags={JSON.stringify(tags)}
      {...props}
    />
  );
}

export default withAutocard;
