import { DndContext } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';

interface SortableItemProps {
  id: string;
  value: string;
}

export const SortableItem: React.FC<SortableItemProps> = ({ id, value }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} {...attributes} {...listeners} style={style}>
      Item {value}
    </li>
  );
};

interface SortableListProps {
  items: string[];
  children: React.ReactNode;
}

export const SortableList: React.FC<SortableListProps> = ({ items, children }) => {
  return (
    <DndContext>
      <SortableContext items={items}>{children}</SortableContext>
    </DndContext>
  );
};
