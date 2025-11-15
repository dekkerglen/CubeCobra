import React from 'react';

import classNames from 'classnames';

interface TextProps {
  children: React.ReactNode;
  xs?: boolean;
  sm?: boolean;
  md?: boolean;
  lg?: boolean;
  xl?: boolean;
  xxl?: boolean;
  xxxl?: boolean;
  xxxxl?: boolean;
  bold?: boolean;
  semibold?: boolean;
  italic?: boolean;
  className?: string;
  id?: string;
  area?: boolean;
  clamp?: number; // New prop to specify the number of lines to clamp
}

const Text: React.FC<TextProps> = ({
  area,
  children,
  xs,
  sm,
  md,
  lg,
  xl,
  xxl,
  xxxl,
  xxxxl,
  bold,
  semibold,
  italic,
  className = '',
  id = '',
}) => {
  const classes = classNames(
    {
      'text-xxs': xs,
      'text-xs': sm,
      'text-sm': md,
      'text-base': lg,
      'text-lg': xl,
      'text-xl': xxl,
      'text-2xl': xxxl,
      'text-3xl': xxxxl,
      'lg:text-xs': xs,
      'lg:text-sm': sm,
      'lg:text-base': md,
      'lg:text-lg': lg,
      'lg:text-xl': xl,
      'lg:text-2xl': xxl,
      'lg:text-3xl': xxxl,
      'lg:text-4xl': xxxxl,
      'font-bold': bold,
      'font-semibold': semibold,
      italic: italic,
    },
    className,
  );

  const optionalProps = {};
  if (id !== '') {
    //@ts-ignore
    optionalProps['id'] = id;
  }

  if (area) {
    return (
      <p {...optionalProps} className={`${classes} h-full`}>
        {children}
      </p>
    );
  }

  return (
    <span {...optionalProps} className={`${classes}`}>
      {children}
    </span>
  );
};

export default Text;
