import React, { ChangeEvent } from 'react';

import Input from './base/Input';
import Select from './base/Select';

interface EnumFilterFieldProps {
  name: string;
  label: string;
  placeholder: string;
  value?: string;
  // Distinct option values gathered from the current cube. When empty (e.g. the
  // global card search, which has no cube to draw from) the field degrades to a
  // free-text input so the filter is still usable.
  options?: { value: string; label: string }[];
  setValue: (value: string) => void;
}

const EnumFilterField: React.FC<EnumFilterFieldProps> = ({ name, label, placeholder, value, options, setValue }) => {
  if (options && options.length > 0) {
    return (
      <Select
        label={label}
        value={value ?? ''}
        setValue={setValue}
        options={[{ value: '', label: 'Any' }, ...options]}
      />
    );
  }

  return (
    <Input
      name={name}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
    />
  );
};

export default EnumFilterField;
