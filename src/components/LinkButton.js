import React from 'react';

import PropTypes from 'prop-types';

const LinkButton = ({ children, onClick, ...props }) => {
  return (
    <a
      href="#"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      {...props}
    >
      {children}
    </a>
  );
};
LinkButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

export default LinkButton;
