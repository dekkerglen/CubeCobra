import React, { useRef } from 'react';

import { XCircleIcon } from '@primer/octicons-react';
import classNames from 'classnames';

import { Flexbox } from './Layout';

/**
 * Replace "smart" / curly quotes (the ones iOS, macOS, and Word inject
 * automatically) with their straight ASCII equivalents. Search filters,
 * card names, and most identifiers in CubeCobra are matched as straight
 * quotes, so an autocorrected apostrophe silently breaks queries like
 * name:"Yawgmoth's Will". Applying this to every shared Input keeps
 * the user's typed value clean wherever it lands.
 */
export const normalizeQuotes = (value: string): string => value.replace(/[‘’‚‛′❛❜]/g, "'").replace(/[“”„‟″❝❞]/g, '"');

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
  type?: 'text' | 'password' | 'email' | 'hidden' | 'number' | 'file' | 'date';
  innerRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEnter?: () => void;
  disabled?: boolean;
  /**
   * When provided, a clear (✕) button is rendered at the right edge of the input
   * while it holds text. Clearing is left to the caller, since what it means
   * differs: a live filter also resets its applied value, while a submit-driven
   * search box only empties its own text.
   */
  onClear?: () => void;
  otherInputProps?: React.InputHTMLAttributes<HTMLInputElement>;
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
  onClear,
  autoCapitalize = 'sentences',
  autoCorrect = 'on',
  spellCheck = true,
  otherInputProps = {},
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const showClear = !!onClear && !disabled && (value ?? '').length > 0;

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
      <div className="relative" ref={wrapperRef}>
        <input
          {...otherInputProps}
          className={classNames(
            'block w-full px-3 py-2 border border-border bg-bg rounded-md shadow-sm placeholder-text-secondary focus:outline-none focus:ring-2 focus:border-focus-ring sm:text-sm transition duration-200 ease-in-out',
            {
              'focus:ring-focus-ring': valid === undefined,
              'focus:ring-green-500 border-green-500': valid === true,
              'focus:ring-red-500 border-red-500': valid === false,
              'opacity-50': disabled,
            },
            className,
          )}
          // Reserved as an inline style rather than a `pr-*` class: a caller's own
          // `pr-3` has equal specificity, so the winner would depend on Tailwind's
          // emission order instead of on intent. Held constant while `onClear` is
          // set so the text does not reflow as the button appears and disappears.
          style={{
            ...otherInputProps.style,
            ...(onClear ? { paddingRight: '2.25rem' } : {}),
          }}
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
          onChange={
            disabled
              ? undefined
              : onChange
                ? (event) => {
                    const next = normalizeQuotes(event.target.value);
                    if (next !== event.target.value) {
                      // Mutate the underlying target so downstream consumers
                      // (controlled `value`, refs, etc.) see the clean string.
                      event.target.value = next;
                    }
                    onChange(event);
                  }
                : undefined
          }
          value={value}
          disabled={disabled}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          spellCheck={spellCheck}
        />
        {showClear && (
          <button
            type="button"
            aria-label="Clear"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
            // Keep the press from blurring the input: callers that commit their
            // value on blur would otherwise re-apply the text being cleared.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onClear();
              wrapperRef.current?.querySelector('input')?.focus();
            }}
          >
            <XCircleIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Input;
