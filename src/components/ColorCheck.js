import React from 'react';

import { FormGroup, Input, Label } from 'reactstrap';

export const ColorChecks = ({ prefix, values, onChange }) =>
  [['White', 'W'], ['Blue', 'U'], ['Black', 'B'], ['Red', 'R'], ['Green', 'G']].map((color) => (
    <ColorCheck
      key={color[1]}
      prefix={prefix}
      color={color[0]}
      short={color[1]}
      value={values[`${prefix || 'color'}${color[1]}`]}
      onChange={onChange}
    />
  ));

const ColorCheck = ({ prefix, color, short, value, onChange }) => (
  <FormGroup check inline>
    <Label check>
      <Input
        type="checkbox"
        id={`contextModalCheckbox${short.toUpperCase()}`}
        name={`${prefix || 'color'}${short.toUpperCase()}`}
        checked={value}
        onChange={onChange}
      />
      <img src={`/content/symbols/${short.toLowerCase()}.png`} alt={color} title={color} />
    </Label>
  </FormGroup>
);

export default ColorCheck;
