import React from 'react';

import classNames from 'classnames';

interface CheckboxProps {
  label: string;
  checked: boolean;
  setChecked: (checked: boolean) => void;
  disabled?: boolean;
}

const Checkbox: React.FC<CheckboxProps> = ({ label, checked, setChecked, disabled = false }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChecked(event.target.checked);
  };

  return (
    <label className={classNames('flex items-center space-x-3', { 'opacity-50': disabled })}>
      <input
        type="checkbox"
        className="form-checkbox h-5 w-5 text-primary-button"
        // Coerced so an undefined value (common when reading out of a sparse map, which the
        // type system can't catch) can't silently leave the input uncontrolled: React would
        // then stop managing its checked state, and the browser's own state would survive
        // re-renders and any reuse of the DOM node.
        checked={!!checked}
        disabled={disabled}
        onChange={handleChange}
      />
      <span className="text-text whitespace-nowrap">{label}</span>
    </label>
  );
};

export default Checkbox;
