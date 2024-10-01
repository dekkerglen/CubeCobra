import classNames from 'classnames';
import React from 'react';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  root?: boolean;
}

const NavLink: React.FC<NavLinkProps> = ({ href, children, root = false }) => {
  return (
    <a
      href={href}
      className={classNames('select-none cursor-pointer font-normal transition-colors duration-200 ease-in-out', {
        'text-text hover:text-text-secondary': !root,
        'text-text-secondary hover:text-text-secondary-active font-semibold px-2': root,
      })}
    >
      {children}
    </a>
  );
};

export default NavLink;
