import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';

import CardImage from './CardImage';
import FoilCardImage from './FoilCardImage';

const DraggableCard = ({ card, location, canDrop, onMoveCard, width, height, className, ...props }) => {
  const [{ isDragging }, drag, preview] = useDrag({
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
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const imageRef = useRef();
  preview(imageRef);

  const [{ isAcceptable }, drop] = useDrop({
    accept: 'card',
    drop: () => location,
    canDrop: (item) => canDrop(item.location, location),
    collect: (monitor) => ({
      isAcceptable: !!monitor.isOver() && !!monitor.canDrop(),
    }),
  });

  const previewClasses = [].concat(isAcceptable ? ['outline'] : [], isDragging ? ['transparent'] : []);
  if (className) {
    Array.prototype.push.apply(previewClasses, className.split(' '));
  }
  
  const oldClasses = [].concat(['position-absolute'], isDragging ? ['transparent'] : ['d-none']);

  const typeLine = (card.type_line || card.details.type).toLowerCase();
  const cnc = typeLine.includes('creature');

  return (
    <>
      <FoilCardImage card={card} innerRef={imageRef} className={oldClasses.join(' ')} />
      <div ref={drag} className={onMoveCard || props.onClick ? 'clickable' : undefined}>
        <div ref={drop}>
          <FoilCardImage
            card={card}
            tags={[]}
            autocard
            className={previewClasses.join(' ')}
            data-location-type={location.type}
            data-location-data={JSON.stringify(location.data)}
            data-cnc={cnc.toString()}
            {...props}
          />
        </div>
      </div>
    </>
  );
};

export default DraggableCard;
