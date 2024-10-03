import React from 'react';
import classNames from 'classnames';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

const Link: React.FC<LinkProps> = ({ href, children, className = '' }) => {
  const classes = classNames('font-medium text-link hover:text-link-active', className);

  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
};

export default Link;
