import React from 'react';

import { Tooltip } from 'reactstrap';

import useNewID from 'hooks/UseNewID';
import useToggle from 'hooks/UseToggle';

const OurTooltip = ({ text, children, ...props }) => {
  const [isOpen, toggle] = useToggle(false);

  const target = useNewID();

  return (
    <>
      <div id={target}>{children}</div>
      <Tooltip
        placement="top"
        boundariesElement="window"
        trigger="hover"
        isOpen={isOpen}
        toggle={toggle}
        target={target}
        {...props}
      >
        {text}
      </Tooltip>
    </>
  );
};

export default OurTooltip;
