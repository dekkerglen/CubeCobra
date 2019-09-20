import React from 'react';

import { FormGroup, Input, Label } from 'reactstrap';

const ColorCheck = ({ color, short, value, onChange }) => (
  <FormGroup check inline>
    <Label check>
      <Input
        type="checkbox"
        id={`contextModalCheckbox${short.toUpperCase()}`}
        name={`color${short.toUpperCase()}`}
        checked={value}
        onChange={onChange}
      />
      <img src={`/content/symbols/${short.toLowerCase()}.png`} alt={color} title={color} />
    </Label>
  </FormGroup>
);

export default ColorCheck;
