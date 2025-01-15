import React from 'react';

import classNames from 'classnames';

interface BadgeProps {
  color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark';
  pill?: boolean;
  className?: string;
  children: React.ReactNode;
}

const Badge: React.FC<BadgeProps> = ({ color = 'primary', pill = false, className, children }) => {
  return (
    <span
      className={classNames(
        'inline-flex items-center px-2.5 py-0.5 text-xs font-medium',
        {
          'rounded-full': pill,
          rounded: !pill,
          'bg-blue-100 text-blue-800': color === 'primary',
          'bg-gray-100 text-gray-800': color === 'secondary',
          'bg-green-100 text-green-800': color === 'success',
          'bg-red-100 text-red-800': color === 'danger',
          'bg-yellow-100 text-yellow-800': color === 'warning',
          'bg-teal-100 text-teal-800': color === 'info',
          'bg-gray-100 text-gray-700': color === 'light',
          'bg-gray-800 text-white': color === 'dark',
        },
        className,
      )}
    >
      {children}
    </span>
  );
};

export default Badge;
