import React from 'react';
import classNames from 'classnames';
import { Flexbox } from './Layout';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  label?: string;
  link?: {
    href: string;
    text: string;
  };
  valid?: boolean;
  value?: string;
  id?: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'hidden' | 'number';
  innerRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const Input: React.FC<InputProps> = ({
  className,
  label,
  link,
  valid,
  id,
  name,
  placeholder,
  type,
  innerRef,
  onKeyDown,
  onChange,
  value,
}) => {
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
      <input
        className={classNames(
          'block w-full h-full px-3 py-2 border border-border bg-bg rounded-md shadow-sm placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-opacity-50 focus:border-focus-ring sm:text-sm transition duration-200 ease-in-out',
          {
            'focus:ring-focus-ring': valid === undefined,
            'focus:ring-green-500 border-green-500': valid === true,
            'focus:ring-red-500 border-red-500': valid === false,
          },
          className,
        )}
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        ref={innerRef}
        onKeyDown={onKeyDown}
        onChange={onChange}
        value={value}
      />
    </div>
  );
};

export default Input;
