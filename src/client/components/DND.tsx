import React from 'react';

import { DndContext } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export const SortableItem: React.FC<SortableItemProps> = ({ id, children, className }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={style} className={className}>
      {children}
    </div>
  );
};

interface SortableListProps {
  items: string[];
  children: React.ReactNode;
  onDragEnd: (event: any) => void;
}

export const SortableList: React.FC<SortableListProps> = ({ items, children, onDragEnd }) => {
  return (
    <DndContext onDragEnd={onDragEnd}>
      <SortableContext strategy={verticalListSortingStrategy} items={items}>
        {children}
      </SortableContext>
    </DndContext>
  );
};
