import React from 'react';
import classNames from 'classnames';
import Flexbox from './Flexbox';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  label?: string;
  link?: {
    href: string;
    text: string;
  };
}

const Input: React.FC<InputProps> = ({ className, label, link, ...props }) => {
  return (
    <div className="block w-full">
      <Flexbox justify="between" direction="row">
        {label && (
          <label className="block text-sm font-medium text-text" htmlFor={props.id}>
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
          'block w-full h-full px-3 py-2 border border-border bg-bg rounded-md shadow-sm placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-opacity-50 focus:border-focus-ring sm:text-sm transition duration-200 ease-in-out',
          className,
        )}
        {...props}
      />
    </div>
  );
};

export default Input;
