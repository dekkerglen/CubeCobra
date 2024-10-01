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
}

const Container: React.FC<ContainerProps> = ({ children, className = '', sm, md, lg, xl, xxl }) => {
  const classes = classNames(
    'w-full',
    {
      'sm:container sm:mx-auto': sm,
      'md:container md:mx-auto': md,
      'lg:container lg:mx-auto': lg,
      'xl:container xl:mx-auto': xl,
      '2xl:container 2xl:mx-auto': xxl,
    },
    className,
  );

  return <div className={classes}>{children}</div>;
};

export default Container;
