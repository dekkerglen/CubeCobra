import React, { forwardRef, useState } from 'react';
import FoilCardImage from 'components/FoilCardImage';

import FlipMove from 'react-flip-move';

const CardItem = forwardRef(({ card, pickup, index, setHover }, ref) => (
  <div ref={ref}>
    <div className="stacked" key={card.cardID}>
      <div className="position-relative">
        <div className="clickable">
          <FoilCardImage
            card={card}
            tags={[]}
            onMouseDown={(event) => {
              if (event.nativeEvent.which === 1) {
                pickup(index);
              }
            }}
            onMouseEnter={setHover}
            className={card.hold ? 'img-hidden' : ''}
          />
        </div>
      </div>
    </div>
  </div>
));

const CardStack = ({ cards, pickup, onHover }) => {
  const [hover, setHover] = useState(-1);

  const handleHover = (index) => {
    onHover(index);
    setHover(index);
  };

  return (
    <div className="stack" onMouseLeave={() => handleHover(-1)}>
      <FlipMove leaveAnimation={false}>
        {cards.map((card, index) => (
          <CardItem key={card.cardID} card={card} pickup={pickup} index={index} setHover={() => handleHover(index)} />
        ))}
      </FlipMove>
    </div>
  );
};

export default CardStack;
