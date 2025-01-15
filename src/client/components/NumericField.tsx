import React from 'react';

import Input from './base/Input';
import { Flexbox } from './base/Layout';
import Select from './base/Select';

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
  <Flexbox direction="row" gap="2" justify="start" alignItems="end">
    <Select
      label={humanName}
      value={operator}
      setValue={(v) => setOperator(v)}
      options={[
        { value: '=', label: 'equal to' },
        { value: '<', label: 'less than' },
        { value: '>', label: 'greater than' },
        { value: '<=', label: 'less than or equal to' },
        { value: '>=', label: 'greater than or equal to' },
        { value: '!=', label: 'not equal to' },
      ]}
    />
    <Input
      type="text"
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  </Flexbox>
);

export default NumericField;
