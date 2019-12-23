import React, { useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';

import ImageFallback from './ImageFallback';
import withAutocard from './WithAutocard';

const CardImage = withAutocard(ImageFallback);

const DraggableCard = ({ card, location, canDrop, onMoveCard, width, height, className, ...props }) => {
  const [{ isDragging }, drag] = useDrag({
    item: { type: 'card', location },
    begin: (monitor) => {
      /* global */ stopAutocard = true;
      /* global */ autocard_hide_card();
    },
    end: (item, monitor) => {
      /* global */ stopAutocard = false;
      if (monitor.didDrop()) {
        onMoveCard(item.location, monitor.getDropResult());
      }
    },
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

  const classes = ['draftcard'].concat(
    isAcceptable ? ['outline'] : [],
    isDragging ? ['transparent'] : [],
  );

  return (
    <div ref={drag}>
      <div ref={drop}>
        <CardImage
          src={card.details.display_image}
          fallbackSrc="/content/default_card.png"
          alt={card.details.name}
          width={width || 150}
          height={height || 210}
          card={card}
          tags={[]}
          className={classes.join(' ')}
          {...props}
        />
      </div>
    </div>
  );
}

export default DraggableCard;
