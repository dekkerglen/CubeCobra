import React from 'react';

import classNames from 'classnames';

interface NavButtonProps {
  children: React.ReactNode;
  className?: string;
  root?: boolean;
  onClick?: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ children, onClick, root = false }) => {
  return (
    <a
      onClick={onClick}
      className={classNames('select-none cursor-pointer font-normal transition-colors duration-200 ease-in-out', {
        'text-text hover:text-text-secondary': !root,
        'text-text-secondary hover:text-text-secondary-active font-semibold px-2': root,
      })}
    >
      {children}
    </a>
  );
};

export default NavButton;
