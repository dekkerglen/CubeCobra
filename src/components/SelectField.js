import React from 'react';

import { InputGroup, InputGroupAddon, InputGroupText, CustomInput } from 'reactstrap';

const SelectField = ({ name, humanName, value, onChange, options, ...props }) => (
  <InputGroup className="mb-3" {...props}>
    <InputGroupAddon addonType="prepend">
      <InputGroupText>{humanName}</InputGroupText>
    </InputGroupAddon>
    <CustomInput type="select" id={name} name={name} value={value} onChange={onChange}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </CustomInput>
  </InputGroup>
);

export default SelectField;
