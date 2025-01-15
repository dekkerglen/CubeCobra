import React from 'react';

import { Flexbox } from './Layout';

interface RadioButtonGroupProps {
  label?: string;
  selected: string;
  setSelected: (selected: string) => void;
  options: { value: string; label: string }[];
}

const RadioButtonGroup: React.FC<RadioButtonGroupProps> = ({ label, selected, setSelected, options }) => {
  return (
    <Flexbox direction="col" gap="2">
      {label && <label className="block text-sm font-medium text-text">{label}</label>}
      {options.map((option) => (
        <label key={option.value} className="flex items-center space-x-3">
          <input
            type="radio"
            className="form-radio h-5 w-5 text-primary-button"
            checked={selected === option.value}
            onChange={() => setSelected(option.value)}
          />
          <span className="text-text whitespace-nowrap">{option.label}</span>
        </label>
      ))}
    </Flexbox>
  );
};

export default RadioButtonGroup;
