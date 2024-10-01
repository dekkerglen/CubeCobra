import React from 'react';
import classNames from 'classnames';

interface ButtonProps {
  children: React.ReactNode;
  color?: 'success' | 'danger' | 'primary' | 'secondary';
  outline?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  block?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  color = 'primary',
  outline = false,
  disabled = false,
  onClick,
  type,
  block,
}) => {
  const classes = classNames(
    'px-2 py-1 rounded focus:outline-none font-semibold transition-colors duration-300 ease-in-out border focus:border-button-text',
    {
      'text-button-text': ['success', 'danger', 'primary', 'secondary'].includes(color) && !outline,
      'text-button-text-secondary': !['success', 'danger', 'primary', 'secondary'].includes(color) && !outline,
      'text-button-success bg-transparent border border-button-success hover:bg-button-success hover:text-button-text':
        outline && color == 'success',
      'bg-button-success border-button-success hover:bg-button-success-active hover:border-button-success-active':
        !outline && color == 'success',
      'text-button-danger bg-transparent border border-button-danger hover:bg-button-danger hover:text-button-text':
        outline && color == 'danger',
      'bg-button-danger border-button-danger hover:bg-button-danger-active': !outline && color == 'danger',
      'text-button-primary bg-transparent border border-button-primary hover:bg-button-primary hover:text-button-text':
        outline && color == 'primary',
      'bg-button-primary border-button-primary hover:bg-button-primary-active': !outline && color == 'primary',
      'text-button-secondary bg-transparent border border-button-secondary hover:bg-button-secondary hover:text-button-text':
        outline && color == 'secondary',
      'bg-button-secondary border-button-secondary hover:bg-button-secondary-active': !outline && color == 'secondary',
      'opacity-50 cursor-not-allowed': disabled,
      'focus:ring-2 focus:ring-focus-ring focus:ring-opacity-50 focus:border-focus-ring': true,
      'w-full': block,
    },
  );

  return (
    <button className={classes} onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  );
};

export default Button;
