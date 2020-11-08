import React from 'react';

import { Tooltip } from 'reactstrap';

import useToggle from 'hooks/UseToggle';

const OurTooltip = ({ text, id, children, ...props }) => {
  const [isOpen, toggle] = useToggle(false);

  return (
    <>
      <div id={id}>{children}</div>
      <Tooltip
        placement="top"
        boundariesElement="window"
        trigger="hover"
        isOpen={isOpen}
        toggle={toggle}
        target={id}
        {...props}
      >
        {text}
      </Tooltip>
    </>
  );
};

export default OurTooltip;
