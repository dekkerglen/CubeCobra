import React from 'react';
import classNames from 'classnames';
import Card from 'datatypes/Card';
import DraftLocation from 'drafting/DraftLocation';
import { DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import FoilCardImage from './FoilCardImage';

interface DraggableCardProps {
  card: Card;
  location: DraftLocation;
  className?: string;
  onClick?: (card: Card) => void;
}

const DraggableCard: React.FC<DraggableCardProps> = ({ card, location, className = '', onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `card-${location.type}-${location.row}-${location.col}-${location.index}`,
    data: location,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${location.type}-${location.row}-${location.col}-${location.index}`,
    data: new DraftLocation(location.type, location.row, location.col, location.index),
    // disabled: !canDrop,
  });

  const previewClasses = classNames({ outline: isOver, transparent: isDragging }, className);

  return (
    <>
      <div ref={setDragRef} className={onClick ? 'clickable' : undefined} {...listeners} {...attributes}>
        <div ref={setDropRef}>
          <FoilCardImage card={card} autocard className={previewClasses} onClick={() => onClick && onClick(card)} />
        </div>
      </div>
      {isDragging && (
        <DragOverlay>
          <FoilCardImage card={card} className="drag-overlay" />
        </DragOverlay>
      )}
    </>
  );
};

export default DraggableCard;
