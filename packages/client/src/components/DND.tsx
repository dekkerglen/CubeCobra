import React from 'react';

import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  id: string;
  children: (props: { handleProps: any }) => React.ReactNode;
  className?: string;
}

export const SortableItem: React.FC<SortableItemProps> = ({ id, children, className }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} {...attributes} style={style} className={className}>
      {children({ handleProps: listeners })}
    </div>
  );
};

interface SortableListProps {
  items: string[];
  children: React.ReactNode;
  onDragEnd: (event: any) => void;
}

export const SortableList: React.FC<SortableListProps> = ({ items, children, onDragEnd }) => {
  // Only use pointer sensors (mouse/touch), not keyboard sensor which would capture space key
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms delay before drag starts on touch
        tolerance: 5,
      },
    }),
  );

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <SortableContext strategy={verticalListSortingStrategy} items={items}>
        {children}
      </SortableContext>
    </DndContext>
  );
};
