import React from 'react';
import { InputGroup, InputGroupText } from 'reactstrap';

import PropTypes from 'prop-types';

const TextBadge = ({ name, className, children, fill }) => (
  <InputGroup size="sm" className={className ? `w-auto ${className}` : 'w-auto'}>
    <InputGroupText className={fill ? `w-50` : ''}>{name}</InputGroupText>
    <InputGroupText className={`${fill ? 'w-50 ' : ''}bg-white`}>{children}</InputGroupText>
  </InputGroup>
);

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
