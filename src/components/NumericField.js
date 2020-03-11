import React from 'react';

import { Input, InputGroup, InputGroupAddon, InputGroupText, CustomInput } from 'reactstrap';

const NumericField = ({ name, humanName, placeholder, valueOp, value, onChange, ...props }) => (
  <InputGroup className="mb-3" {...props}>
    <InputGroupAddon addonType="prepend">
      <InputGroupText>{humanName}</InputGroupText>
    </InputGroupAddon>
    <CustomInput type="select" id={`${name}Op`} name={`${name}Op`} value={valueOp} onChange={onChange}>
      <option value="=">equal to</option>
      <option value="<">less than</option>
      <option value=">">greater than</option>
      <option value="<=">less than or equal to</option>
      <option value=">=">greater than or equal to</option>
      <option value="!=">not equal to</option>
    </CustomInput>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} />
  </InputGroup>
);

export default NumericField;
