import React from 'react';

import { InputGroup, InputGroupAddon, InputGroupText } from 'reactstrap';

const TextBadge = ({ name, className, children, fill }) => (
  <InputGroup size="sm" className={className ? `w-auto ${className}` : 'w-auto'}>
    <InputGroupAddon className={fill ? 'w-50' : '' } addonType="prepend">
      <InputGroupText className={fill ? `w-100` : ''}>{name}</InputGroupText>
    </InputGroupAddon>
    <InputGroupAddon className={fill ? 'w-50' : '' } addonType="append">
      <InputGroupText className={(fill ? 'w-100 ' : '') +"bg-white"}>{children}</InputGroupText>
    </InputGroupAddon>
  </InputGroup>
);

export default TextBadge;
