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

  const classes = ['draft-card'].concat(
    isAcceptable ? ['outline'] : [],
    isDragging ? ['transparent'] : [],
  );

  const typeLine = (card.type_line || card.details.type).toLowerCase();
  const cnc = typeLine.includes('creature') ? 0 : 1;

  return (
    <div ref={drag}>
      <div ref={drop}>
        <CardImage
          src={card.details.display_image}
          fallbackSrc="/content/default_card.png"
          alt={card.details.name}
          width="100%"
          card={card}
          tags={[]}
          className={classes.join(' ')}
          data-location-type={location.type}
          data-location-data={JSON.stringify(location.data)}
          data-cnc={cnc.toString()}
          {...props}
        />
      </div>
    </div>
  );
}

export default DraggableCard;
