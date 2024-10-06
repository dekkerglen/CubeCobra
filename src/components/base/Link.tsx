import React from 'react';
import classNames from 'classnames';

interface LinkProps {
  href?: string;
  children: React.ReactNode;
  className?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
}

const Link: React.FC<LinkProps> = ({ href, children, target, rel, onClick, className = '' }) => {
  const classes = classNames('hover:cursor-pointer font-medium text-link hover:text-link-active', className);

  if (href && href !== '#') {
    return (
      <a href={href} className={classes} target={target} rel={rel}>
        {children}
      </a>
    );
  }

  return (
    <a className={classes} onClick={onClick}>
      {children}
    </a>
  );
};

export default Link;
