import React from 'react';
import classNames from 'classnames';

interface SelectProps {
  options: { value: string; label: string }[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}

const Select: React.FC<SelectProps> = ({ options, defaultValue, onChange, className = '' }) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  const classes = classNames(
    'block w-full px-3 py-2 border border-border bg-bg rounded-md shadow-sm sm:text-sm placeholder-text-secondary',
    'focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-focus-ring transition duration-200 ease-in-out',
    className,
  );

  return (
    <select className={classes} defaultValue={defaultValue} onChange={handleChange}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default Select;
