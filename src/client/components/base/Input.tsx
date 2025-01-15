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
  type?: 'text' | 'password' | 'email' | 'hidden' | 'number' | 'file';
  innerRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEnter?: () => void;
  disabled?: boolean;
}

const Input: React.FC<InputProps> = ({
  className,
  label,
  link,
  valid,
  id,
  placeholder,
  type,
  innerRef,
  onKeyDown,
  onChange,
  value,
  disabled = false,
  onEnter,
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
            'opacity-50': disabled,
          },
          className,
        )}
        id={id}
        type={type}
        placeholder={placeholder}
        ref={innerRef}
        onKeyDown={
          disabled
            ? undefined
            : (event) => {
                if (onEnter && event.key === 'Enter') {
                  onEnter();
                }

                if (onKeyDown) {
                  onKeyDown(event);
                }
              }
        }
        onChange={disabled ? undefined : onChange}
        value={value}
        disabled={disabled}
      />
    </div>
  );
};

export default Input;
