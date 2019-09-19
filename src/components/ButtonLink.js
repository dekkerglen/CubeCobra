import React from 'react';

import { Button } from 'reactstrap';

const ButtonLink = ({ href, children, ...props }) => (
  <a href={href}>
    <Button {...props}>{children}</Button>
  </a>
);

export default ButtonLink;