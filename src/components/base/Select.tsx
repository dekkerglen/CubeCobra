import React from 'react';
import classNames from 'classnames';

import { Flexbox } from './Layout';

interface SelectProps {
  options: { value: string; label: string }[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  label?: string;
  link?: {
    href: string;
    text: string;
  };
  id?: string;
}

const Select: React.FC<SelectProps> = ({ options, defaultValue, value, onChange, label, link, id, className = '' }) => {
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
    <div className="block w-full">
      <Flexbox justify="between" direction="row">
        {label && (
          <label className="block text-sm font-medium text-text" htmlFor={id}>
            {label}
          </label>
        )}
        {link && (
          <a href={link.href} className="text-sm font-medium text-link hover:text-link-active">
            {link.text}
          </a>
        )}
      </Flexbox>
      <select className={classes} defaultValue={defaultValue} onChange={handleChange} id={id} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;
