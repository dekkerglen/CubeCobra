import React from 'react';
import classNames from 'classnames';

interface ResponsiveDivProps {
  children: React.ReactNode;
  baseVisible?: boolean; // Determines if the base class is `block` or `hidden`
  sm?: boolean;
  md?: boolean;
  lg?: boolean;
  xl?: boolean;
  xxl?: boolean;
  className?: string;
}

const ResponsiveDiv: React.FC<ResponsiveDivProps> = ({
  children,
  baseVisible = false,
  sm,
  md,
  lg,
  xl,
  xxl,
  className = '',
}) => {
  const classes = classNames(
    baseVisible ? 'block' : 'hidden',
    {
      'sm:block': sm && !baseVisible,
      'sm:hidden': sm && baseVisible,
      'md:block': md && !baseVisible,
      'md:hidden': md && baseVisible,
      'lg:block': lg && !baseVisible,
      'lg:hidden': lg && baseVisible,
      'xl:block': xl && !baseVisible,
      'xl:hidden': xl && baseVisible,
      '2xl:block': xxl && !baseVisible,
      '2xl:hidden': xxl && baseVisible,
    },
    className,
  );

  return <div className={classes}>{children}</div>;
};

export default ResponsiveDiv;
