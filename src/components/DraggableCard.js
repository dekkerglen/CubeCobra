import React, { useContext, useRef } from 'react';

import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import { useDrag, useDrop } from 'react-dnd';

import FoilCardImage from 'components/FoilCardImage';
import AutocardContext from 'contexts/AutocardContext';

const DraggableCard = ({ card, location, canDrop, onMoveCard, className, onClick, ...props }) => {
  const { hideCard, setStopAutocard } = useContext(AutocardContext);

  const [{ isDragging }, drag, preview] = useDrag({
    type: 'card',
    item: () => {
      setStopAutocard(true);
      hideCard();
      return { type: 'card', location };
    },
    end: (item, monitor) => {
      setStopAutocard(false);
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
      <div ref={drag} className={onMoveCard || onClick ? 'clickable' : undefined}>
        <div ref={drop}>
          <FoilCardImage
            card={card}
            tags={[]}
            autocard
            className={previewClasses.join(' ')}
            data-location-type={location.type}
            data-location-data={JSON.stringify(location.data)}
            data-cnc={cnc.toString()}
            onClick={() => onClick(card)}
            {...props}
          />
        </div>
      </div>
    </>
  );
};

DraggableCard.propTypes = {
  card: CardPropType.isRequired,
  location: PropTypes.shape({
    type: PropTypes.string,
    data: PropTypes.shape({}),
  }).isRequired,
  canDrop: PropTypes.func.isRequired,
  onMoveCard: PropTypes.func.isRequired,
  className: PropTypes.string,
  onClick: PropTypes.func,
};

DraggableCard.defaultProps = {
  className: '',
  onClick: null,
};

export default DraggableCard;
