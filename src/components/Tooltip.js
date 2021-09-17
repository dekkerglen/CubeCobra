import React, { useRef } from 'react';
import PropTypes from 'prop-types';

import { UncontrolledTooltip } from 'reactstrap';

const Tooltip = ({ text, children, wrapperTag, tooltipProps, ...props }) => {
  const divRef = useRef();
  const Tag = wrapperTag || 'div';
  return (
    <>
      <Tag ref={divRef} {...props}>
        {children}
      </Tag>
      <UncontrolledTooltip placement="top" boundariesElement="window" trigger="hover" target={divRef} {...tooltipProps}>
        {text}
      </UncontrolledTooltip>
    </>
  );
};

Tooltip.propTypes = {
  text: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  wrapperTag: PropTypes.oneOfType([PropTypes.node, PropTypes.string]),
  tooltipProps: PropTypes.shape({}),
};

Tooltip.defaultProps = {
  wrapperTag: 'div',
  tooltipProps: {},
};

export default Tooltip;
