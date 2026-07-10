import React from 'react';

import { Flexbox } from './base/Layout';
import Select from './base/Select';

interface SelectFieldProps {
  humanName: string;
  operator?: string;
  value?: string;
  options: { value: string; label: string }[];
  setValue: (value: string) => void;
  setOperator: (value: string) => void;
}

// Like NumericField, but the value is chosen from a dropdown rather than typed.
// Used for ordered enum fields (e.g. rarity) where comparison operators still
// make sense but the set of values is fixed.
const SelectField: React.FC<SelectFieldProps> = ({
  humanName,
  operator = '=',
  value = '',
  options,
  setValue,
  setOperator,
}) => (
  <Flexbox direction="row" gap="2" justify="start" alignItems="end">
    <Select
      label={humanName}
      value={operator}
      setValue={setOperator}
      options={[
        { value: '=', label: 'equal to' },
        { value: '<', label: 'less than' },
        { value: '>', label: 'greater than' },
        { value: '<=', label: 'less than or equal to' },
        { value: '>=', label: 'greater than or equal to' },
        { value: '!=', label: 'not equal to' },
      ]}
    />
    <Select value={value} setValue={setValue} options={[{ value: '', label: 'Any' }, ...options]} />
  </Flexbox>
);

export default SelectField;
