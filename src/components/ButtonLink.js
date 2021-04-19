import React from 'react';

const ButtonLink = ({ children, outline, color = 'primary', block, ...props }) => {
  let type = outline ? `btn-outline-${color}` : `btn-${color}`;

  return (
    <a className={`btn ${type} ${block ? 'btn-block' : ''}`} {...props} role="button">
      {children}
    </a>
  );
};

export default ButtonLink;
