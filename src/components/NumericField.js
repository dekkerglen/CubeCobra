import React from 'react';
import PropTypes from 'prop-types';

import { Input, InputGroup, InputGroupText } from 'reactstrap';

function NumericField({ name, humanName, placeholder, operator, value, setValue, setOperator }) {
  return (
    <InputGroup className="mb-3">
      <InputGroupText>{humanName}</InputGroupText>
      <Input
        type="select"
        id={`${name}Op`}
        name={`${name}Op`}
        value={operator}
        onChange={(event) => setOperator(event.target.value)}
      >
        <option value="=">equal to</option>
        <option value="<">less than</option>
        <option value=">">greater than</option>
        <option value="<=">less than or equal to</option>
        <option value=">=">greater than or equal to</option>
        <option value="!=">not equal to</option>
      </Input>
      <Input
        type="text"
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </InputGroup>
  );
}

NumericField.propTypes = {
  name: PropTypes.string.isRequired,
  humanName: PropTypes.string.isRequired,
  placeholder: PropTypes.string.isRequired,
  operator: PropTypes.string,
  value: PropTypes.string,
  setValue: PropTypes.func.isRequired,
  setOperator: PropTypes.func.isRequired,
};

NumericField.defaultProps = {
  operator: '=',
  value: '',
};

export default NumericField;
