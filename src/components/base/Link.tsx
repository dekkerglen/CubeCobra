import React from 'react';
import classNames from 'classnames';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
}

const Link: React.FC<LinkProps> = ({ href, children, target, rel, className = '' }) => {
  const classes = classNames('font-medium text-link hover:text-link-active', className);

  return (
    <a href={href} className={classes} target={target} rel={rel}>
      {children}
    </a>
  );
};

export default Link;
