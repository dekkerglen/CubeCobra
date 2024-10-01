import React, { MouseEventHandler } from 'react';
import classNames from 'classnames';

interface LinkButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  onClick: MouseEventHandler<HTMLAnchorElement>;
  children: React.ReactNode;
}

const LinkButton: React.FC<LinkButtonProps> = ({ children, onClick }) => {
  return (
    <a
      href="#"
      onClick={(event) => {
        event.preventDefault();
        onClick(event);
      }}
      className={classNames(
        'select-none cursor-pointer font-normal transition-colors duration-200 ease-in-out text-text hover:text-text-secondary',
      )}
    >
      {children}
    </a>
  );
};

export default LinkButton;
