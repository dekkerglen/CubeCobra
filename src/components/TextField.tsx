import React, { ChangeEventHandler } from 'react';
import { Input, InputGroup, InputGroupText } from 'reactstrap';

interface TextFieldProps {
  name: string;
  humanName: string;
  placeholder?: string;
  value?: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

const TextField: React.FC<TextFieldProps> = ({ name, humanName, placeholder, value = '', onChange }) => (
  <InputGroup className="mb-3">
    <InputGroupText>{humanName}</InputGroupText>
    <Input type="text" name={name} placeholder={placeholder} value={value} onChange={onChange} />
  </InputGroup>
);

export default TextField;
