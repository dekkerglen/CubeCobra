import React from 'react';
import PropTypes from 'prop-types';

import { Input, InputGroup, InputGroupText } from 'reactstrap';

const TextField = ({ name, humanName, placeholder, value, onChange, ...props }) => (
  <InputGroup className="mb-3" {...props}>
    <InputGroupText>{humanName}</InputGroupText>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} {...props} />
  </InputGroup>
);

TextField.propTypes = {
  name: PropTypes.string.isRequired,
  humanName: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

TextField.defaultProps = {
  placeholder: undefined,
};

export default TextField;
