import React, { useEffect,useState } from 'react';

import classNames from 'classnames';

import { Flexbox } from './Layout';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
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
  innerRef?: React.Ref<HTMLTextAreaElement>;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  disabled?: boolean;
  showCharacterLimit?: boolean;
}

const TextArea: React.FC<TextAreaProps> = ({
  className,
  label,
  link,
  valid,
  id,
  placeholder,
  innerRef,
  onKeyDown,
  onChange,
  value,
  rows = 4,
  disabled = false,
  showCharacterLimit = false,
  maxLength,
  ...props
}) => {
  const [textLength, setTextLength] = useState(value !== undefined ? value.length : 0);

  useEffect(() => {
    setTextLength(value !== undefined ? value.length : 0);
  }, [value]);

  const handleChange = async (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextLength(event.target.textLength);
    if (onChange) {
      //Don't need to wait for this to finish
      onChange(event);
    }
  };

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
      <textarea
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
        placeholder={placeholder}
        ref={innerRef}
        onKeyDown={disabled ? undefined : onKeyDown}
        onChange={disabled ? undefined : handleChange}
        value={value}
        rows={rows}
        disabled={disabled}
        maxLength={maxLength}
        {...props}
      />
      {showCharacterLimit && maxLength ? (
        <div
          className={classNames('p-2 rounded-b-md', {
            'bg-red-100 text-red-800': textLength >= maxLength,
          })}
        >
          {textLength} / {maxLength}
        </div>
      ) : null}
    </div>
  );
};

export default TextArea;
