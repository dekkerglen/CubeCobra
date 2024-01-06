import React from 'react';
import PropTypes from 'prop-types';

import { InputGroup, InputGroupText } from 'reactstrap';

function TextBadge({ name, className, children, fill }) {
  return (
    <InputGroup size="sm" className={className ? `w-auto ${className}` : 'w-auto'}>
      <InputGroupText className={fill ? `w-50` : ''}>{name}</InputGroupText>
      <InputGroupText className={`${fill ? 'w-50 ' : ''}bg-white`}>{children}</InputGroupText>
    </InputGroup>
  );
}

TextBadge.propTypes = {
  name: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
  fill: PropTypes.bool,
};

TextBadge.defaultProps = {
  name: 'textBade',
  fill: false,
  className: undefined,
};

export default TextBadge;
