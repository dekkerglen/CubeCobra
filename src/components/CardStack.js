import React from 'react';
import { useDrop } from 'react-dnd';

import { Col } from 'reactstrap';

const CardStack = ({ location, children, ...props }) => {
  const [{ isAcceptable }, drop] = useDrop({
    accept: 'card',
    drop: () => location,
    canDrop: item => true,
    collect: monitor => ({
      isAcceptable: !!monitor.isOver() && !!monitor.canDrop(),
    }),
  });

  return (
    <div ref={drop}>
      <Col className="stack mt-3" {...props}>
        {children}
      </Col>
    </div>
  );
};

export default CardStack;
