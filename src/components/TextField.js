import React, { Component } from 'react';

import { Input, InputGroup, InputGroupAddon, InputGroupText } from 'reactstrap';

const TextField = ({ name, humanName, placeholder, value, onChange, ...props }) => (
  <InputGroup className="mb-3" {...props}>
    <InputGroupAddon addonType="prepend">
      <InputGroupText>{humanName}</InputGroupText>
    </InputGroupAddon>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} />
  </InputGroup>
);

export default TextField;
