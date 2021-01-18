import React, { useRef } from 'react';
import PropTypes from 'prop-types';

import { UncontrolledTooltip } from 'reactstrap';

const Tooltip = ({ text, children, ...props }) => {
  const divRef = useRef();
  return (
    <>
      <div ref={divRef}>{children}</div>
      <UncontrolledTooltip placement="top" boundariesElement="window" trigger="hover" target={divRef} {...props}>
        {text}
      </UncontrolledTooltip>
    </>
  );
};

Tooltip.propTypes = {
  text: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

export default Tooltip;
