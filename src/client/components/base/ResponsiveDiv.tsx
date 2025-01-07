import React from 'react';
import classNames from 'classnames';

interface ResponsiveDivProps {
  children: React.ReactNode;
  baseVisible?: boolean; // Determines if the base class is `block` or `hidden`
  xs?: boolean;
  sm?: boolean;
  md?: boolean;
  lg?: boolean;
  xl?: boolean;
  xxl?: boolean;
  xxxl?: boolean;
  className?: string;
}

const ResponsiveDiv: React.FC<ResponsiveDivProps> = ({
  children,
  baseVisible = false,
  xs,
  sm,
  md,
  lg,
  xl,
  xxl,
  xxxl,
  className = '',
}) => {
  const classes = classNames(
    baseVisible ? 'block' : 'hidden',
    {
      'xs:block': xs && !baseVisible,
      'xs:hidden': xs && baseVisible,
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
      '3xl:block': xxxl && !baseVisible,
      '3xl:hidden': xxxl && baseVisible,
    },
    className,
  );

  return <div className={classes}>{children}</div>;
};

export default ResponsiveDiv;
