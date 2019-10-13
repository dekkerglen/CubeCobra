import React, { useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';

import ImageFallback from './ImageFallback';

const handleMouseOver = event => {
  const target = event.target;
  const front = target.getAttribute('data-front');
  const back = target.getAttribute('data-back');
  /* global */ autocard_show_card(front, back, false, null);
}

const handleMouseOut = event => {
  /* global */ autocard_hide_card();
}

const DraggableCard = ({ card, location, canDrop, onMoveCard }) => {
  const [{ isDragging }, drag] = useDrag({
    item: { type: 'card', location },
    end: (item, monitor) => monitor.didDrop() && onMoveCard(item.location, monitor.getDropResult()),
    collect: monitor => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const [{ isAcceptable }, drop] = useDrop({
    accept: 'card',
    drop: () => location,
    canDrop: item => canDrop(item.location, location),
    collect: monitor => ({
      isAcceptable: !!monitor.isOver() && !!monitor.canDrop(),
    }),
  });

  useEffect(() => {
    if (isDragging) {
      autocard_hide_card();
    }
  });

  return (
    <div className="draggable-card" ref={drag}>
      <div ref={drop}>
        <ImageFallback
          src={card.details.display_image}
          fallbackSrc="/content/default_card.png"
          alt={card.details.name}
          width={150}
          height={210}
          data-front={card.details.display_image}
          data-back={card.details.image_flip || undefined}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
          className={isAcceptable ? 'outline' : ''}
          style={isDragging ? { opacity: 0.5 } : {}}
        />
      </div>
    </div>
  );
}

export default DraggableCard;