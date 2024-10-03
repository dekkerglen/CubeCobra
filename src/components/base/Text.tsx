import React from 'react';
import classNames from 'classnames';

interface TextProps {
  children: React.ReactNode;
  xs?: boolean;
  sm?: boolean;
  md?: boolean;
  lg?: boolean;
  xl?: boolean;
  bold?: boolean;
  semibold?: boolean;
  italic?: boolean;
  className?: string;
  area?: boolean;
  clamp?: number; // New prop to specify the number of lines to clamp
}

const Text: React.FC<TextProps> = ({ area, children, xs, sm, md, lg, xl, bold, semibold, italic, className = '' }) => {
  const classes = classNames(
    {
      'text-xxs': xs,
      'text-xs': sm,
      'text-sm': md,
      'text-base': lg,
      'text-lg': xl,
      'md:text-xs': xs,
      'md:text-sm': sm,
      'md:text-base': md,
      'md:text-lg': lg,
      'md:text-xl': xl,
      'font-bold': bold,
      'font-semibold': semibold,
      italic: italic,
    },
    className,
  );

  if (area) {
    return <p className={`${classes} h-full overflow-hidden`}>{children}</p>;
  }

  return <span className={`${classes} overflow-hidden`}>{children}</span>;
};

export default Text;
