import React from 'react';
import { useDrop } from 'react-dnd';

import { Col } from 'reactstrap';

const CardStack = ({ location, children, ...props }) => {
  const [{ isAcceptable }, drop] = useDrop({
    accept: 'card',
    drop: (item, monitor) => monitor.didDrop() ? undefined : location,
    canDrop: item => true,
    collect: monitor => ({
      isAcceptable: !!monitor.isOver({ shallow: true }) && !!monitor.canDrop(),
    }),
  });

  let className = 'mt-3 card-stack'
  if (isAcceptable) {
    className += ' outline';
  }

  return (
    <div ref={drop}>
      <Col className={className} {...props}>
        {!Array.isArray(children) ? '' :
          <div className="w-100 text-center mb-1">
            <b>{children.length}</b>
          </div>
        }
        <div className="stack">
          {children}
        </div>
      </Col>
    </div>
  );
};

export default CardStack;
