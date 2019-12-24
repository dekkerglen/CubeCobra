import React, { useEffect, useRef } from 'react';
import { DragPreviewImage, useDrag, useDrop } from 'react-dnd';

import CardImage from './CardImage';

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
    collect: monitor => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  const imageRef = useRef();

  useEffect(() => {
    if (!preview.current) {
      const div = document.createElement('div');
      const image = new Image();
      image.src = card.imgUrl || card.details.image_normal;
      div.appendChild(image);
      image.onload = () => {
        console.log('loaded');
        if (imageRef.current) {
          console.log('setting', imageRef.current.clientWidth);
          div.style.width = imageRef.current.clientWidth;
          div.style.height = 'auto';
          console.log('result', image.width);
        }
        div.style.borderRadius = '4% / 2.858%';
        div.style.opacity = '0.8';
        preview(div);
      };
      image.onerror = () => {
        image.src = '/content/default_card.png';
      };
    }
  }, [drag, preview]);

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
  const cnc = typeLine.includes('creature');

  return (
    <div ref={drag}>
      <div ref={drop}>
        <CardImage
          card={card}
          tags={[]}
          innerRef={imageRef}
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
