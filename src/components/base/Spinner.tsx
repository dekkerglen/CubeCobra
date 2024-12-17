import classNames from 'classnames';
import React from 'react';

interface SpinnerProps {
  sm?: boolean;
  md?: boolean;
  lg?: boolean;
  xl?: boolean;
  color?: 'primary' | 'secondary' | 'accent';
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ sm, md, lg, xl, color = 'primary', className = '' }) => {
  const defaultSize = !sm && !md && !lg;

  return (
    <svg
      className={classNames(
        `animate-spin`,
        className,
        {
          'h-4 w-4': sm,
          'h-6 w-6': md || defaultSize,
          'h-12 w-12': lg,
          'h-16 w-16': xl,
          'text-primary': color === 'primary',
          'text-secondary': color === 'secondary',
          'text-accent': color === 'accent',
        },
        className,
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
};

export default Spinner;
