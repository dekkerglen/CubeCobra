import React from 'react';
import PropTypes from 'prop-types';

const LinkButton = ({ children, onClick, ...props }) => {
  return (
    /* eslint-disable-next-line jsx-a11y/anchor-is-valid */
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
