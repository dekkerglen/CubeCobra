import React from 'react';

import { Button } from 'reactstrap';

const ButtonLink = ({ children, outline, color, block, ...props }) => {

  let c = color ? color : 'primary';
  let type = outline ? `btn-outline-${color}` : `btn-${color}`;


 return (
  <a class={`btn ${type} ${block ? 'btn-block' : ''}`} {...props} role="button">{children}</a>
 );
};

export default ButtonLink;
