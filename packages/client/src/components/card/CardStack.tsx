import React, { ReactNode } from 'react';

import { useDroppable } from '@dnd-kit/core';
import classNames from 'classnames';

import DraftLocation from '../../drafting/DraftLocation';
import { Col, ColProps } from '../base/Layout';

export interface CardStackProps extends ColProps {
  location: DraftLocation;
  children: ReactNode;
}

const CardStack: React.FC<CardStackProps> = ({ location, children }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `card-stack-${location.type}-${location.row}-${location.col}`,
    data: location,
  });

  return (
    <div ref={setNodeRef} className="rounded-md">
      <Col className={`relative ${isOver ? 'outline' : ''}`} xs={1}>
        {Array.isArray(children) && (
          <div className="w-full text-center mb-1">
            <b>{children.length > 0 ? children.length : ''}</b>
          </div>
        )}
        <div className={classNames('stack', { 'drop-active': isOver })}>{children}</div>
      </Col>
    </div>
  );
};

export default CardStack;
