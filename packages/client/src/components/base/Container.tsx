import React from 'react';

import classNames from 'classnames';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  sm?: boolean;
  md?: boolean;
  lg?: boolean;
  xl?: boolean;
  xxl?: boolean;
  xxxl?: boolean;
}

const Container: React.FC<ContainerProps> = ({ children, className = '', sm, md, lg, xl, xxl, xxxl }) => {
  const classes = classNames(
    {
      'mx-auto': true,
      container: !sm && !md && !lg && !xl && !xxl && !xxxl, // Default container class if no size is specified
      'sm:max-w-screen-sm': sm,
      'md:max-w-screen-md': md,
      'lg:max-w-screen-lg': lg,
      'xl:max-w-screen-xl': xl,
      '2xl:max-w-screen-2xl': xxl,
      '3xl:max-w-screen-3xl': xxxl,
    },
    className,
  );

  return <div className={classes}>{children}</div>;
};

export default Container;
