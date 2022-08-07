import React from 'react';
import PropTypes from 'prop-types';

import { Input, InputGroup, InputGroupText } from 'reactstrap';

const TextField = ({ name, humanName, placeholder, value, onChange }) => (
  <InputGroup className="mb-3">
    <InputGroupText>{humanName}</InputGroupText>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} />
  </InputGroup>
);

TextField.propTypes = {
  name: PropTypes.string.isRequired,
  humanName: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

TextField.defaultProps = {
  placeholder: undefined,
  value: '',
};

export default TextField;
