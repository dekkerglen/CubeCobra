import React from 'react';

import { InputGroup, InputGroupAddon, InputGroupText } from 'reactstrap';

const TextBadge = ({ name, className, children }) => (
  <InputGroup size="sm" className={className ? `w-auto ${className}` : 'w-auto'}>
    <InputGroupAddon addonType="prepend">
      <InputGroupText>{name}</InputGroupText>
    </InputGroupAddon>
    <InputGroupAddon addonType="append">
      <InputGroupText className="bg-white">{children}</InputGroupText>
    </InputGroupAddon>
  </InputGroup>
);

export default TextBadge;