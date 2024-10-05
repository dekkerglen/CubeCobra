import React from 'react';
import classNames from 'classnames';

export interface ButtonProps {
  children: React.ReactNode;
  color?: 'primary' | 'danger' | 'accent' | 'secondary';
  outline?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
  type?: 'button' | 'submit' | 'reset' | 'link';
  block?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  color = 'accent',
  outline = false,
  disabled = false,
  onClick,
  href,
  target,
  rel,
  type,
  block,
}) => {
  const classes = classNames(
    'px-2 py-1 rounded focus:outline-none font-semibold transition-colors duration-300 ease-in-out border focus:border-button-text',
    {
      'text-button-text': ['primary', 'danger', 'accent', 'secondary'].includes(color) && !outline,
      'text-button-text-secondary': !['primary', 'danger', 'accent', 'secondary'].includes(color) && !outline,
      'text-button-primary bg-transparent border border-button-primary hover:bg-button-primary hover:text-button-text':
        outline && color == 'primary',
      'bg-button-primary border-button-primary hover:bg-button-primary-active hover:border-button-primary-active':
        !outline && color == 'primary',
      'text-button-danger bg-transparent border border-button-danger hover:bg-button-danger hover:text-button-text':
        outline && color == 'danger',
      'bg-button-danger border-button-danger hover:bg-button-danger-active hover:border-button-danger-active':
        !outline && color == 'danger',
      'text-button-accent bg-transparent border border-button-accent hover:bg-button-accent hover:text-button-text':
        outline && color == 'accent',
      'bg-button-accent border-button-accent hover:bg-button-accent-active hover:border-button-accent-active':
        !outline && color == 'accent',
      'text-button-secondary bg-transparent border border-button-secondary hover:bg-button-secondary hover:text-button-text':
        outline && color == 'secondary',
      'bg-button-secondary border-button-secondary hover:bg-button-secondary-active': !outline && color == 'secondary',
      'opacity-50 cursor-not-allowed': disabled,
      'focus:ring-2 focus:ring-focus-ring focus:ring-opacity-50 focus:border-focus-ring': true,
      'w-full': block,
    },
  );

  if (type === 'link') {
    return (
      <a className={classes} href={href} target={target} rel={rel}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  );
};

export default Button;
