import React from 'react';
import { Input, InputGroup, InputGroupText } from 'reactstrap';

interface NumericFieldProps {
  name: string;
  humanName: string;
  placeholder: string;
  operator?: string;
  value?: string;
  setValue: (value: string) => void;
  setOperator: (value: string) => void;
}

const NumericField: React.FC<NumericFieldProps> = ({
  name,
  humanName,
  placeholder,
  operator = '=',
  value = '',
  setValue,
  setOperator,
}) => (
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

export default NumericField;
