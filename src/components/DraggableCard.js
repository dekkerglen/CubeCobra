import React, { useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';

import ImageFallback from './ImageFallback';
import withAutocard from './WithAutocard';

const CardImage = withAutocard(ImageFallback);

const DraggableCard = ({ card, location, canDrop, onMoveCard, width, height, ...props }) => {
  const [{ isDragging }, drag] = useDrag({
    item: { type: 'card', location },
    begin: (monitor) => /* global */ autocard_hide_card(),
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
        <CardImage
          src={card.details.display_image}
          fallbackSrc="/content/default_card.png"
          alt={card.details.name}
          width={width || 150}
          height={height || 210}
          card={card}
          tags={[]}
          className={isAcceptable ? 'outline' : ''}
          style={isDragging ? { opacity: 0.5 } : {}}
          {...props}
        />
      </div>
    </div>
  );
}

export default DraggableCard;
