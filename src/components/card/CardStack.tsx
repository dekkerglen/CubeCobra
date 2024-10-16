import React, { ReactNode } from 'react';
import { Col, ColProps } from 'reactstrap';
import { useDroppable } from '@dnd-kit/core';

export interface CardStackProps extends ColProps {
  location: unknown;
  children: ReactNode;
}

const CardStack: React.FC<CardStackProps> = ({ location, children, ...props }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: 'card-stack',
    data: { location },
  });

  let className = 'mt-3 col-md-1-5 col-lg-1-5 col-xl-1-5 col-low-padding';
  if (isOver) {
    className += ' outline';
  }

  return (
    <Col className={className} xs={3} {...props}>
      <div ref={setNodeRef}>
        {!Array.isArray(children) ? (
          ''
        ) : (
          <div className="w-full text-center mb-1">
            <b>{children.length > 0 ? children.length : ''}</b>
          </div>
        )}
        <div className="stack">{children}</div>
      </div>
    </Col>
  );
};

export default CardStack;
