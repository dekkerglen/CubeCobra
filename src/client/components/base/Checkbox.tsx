import React from 'react';

interface CheckboxProps {
  label: string;
  checked: boolean;
  setChecked: (checked: boolean) => void;
}

const Checkbox: React.FC<CheckboxProps> = ({ label, checked, setChecked }) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChecked(event.target.checked);
  };

  return (
    <label className="flex items-center space-x-3">
      <input
        type="checkbox"
        className="form-checkbox h-5 w-5 text-primary-button"
        checked={checked}
        onChange={handleChange}
      />
      <span className="text-text whitespace-nowrap">{label}</span>
    </label>
  );
};

//aaaggg
export default Checkbox;
