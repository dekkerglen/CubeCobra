import React from 'react';

import { DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import Card from '@utils/datatypes/Card';
import classNames from 'classnames';

import DraftLocation from '../drafting/DraftLocation';
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
  });

  const previewClasses = classNames(
    {
      outline: isOver && !isDragging,
      transparent: isDragging,
    },
    className,
  );

  const containerClasses = classNames('no-touch-action', {
    clickable: !!onClick,
    'ring-2 ring-blue-400 ring-offset-2': isOver && !isDragging,
  });

  return (
    <>
      <div ref={setDragRef} className={containerClasses} {...listeners} {...attributes}>
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
