import React from 'react';

import classNames from 'classnames';

interface ControlsProps {
  children: React.ReactNode;
  className?: string;
}

const Controls: React.FC<ControlsProps> = ({ children, className = '' }) => {
  const classes = classNames(
    'bg-gradient-to-b from-bg-accent to-bg-active',
    'border-r border-l border-b border-border',
    'rounded-b-md',
    className,
  );

  return <div className={classes}>{children}</div>;
};

export default Controls;
