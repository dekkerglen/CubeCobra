import React, { FC, ReactNode, useContext } from 'react';

import classNames from 'classnames';

import UserContext from '../../contexts/UserContext';
import { Flexbox } from './Layout';

interface ListGroupProps {
  children: ReactNode;
}

interface ListGroupItemProps {
  children: ReactNode;
  className?: string;
  active?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  onAuxClick?: (event: React.MouseEvent) => void;
  heading?: boolean;
  last?: boolean;
  first?: boolean;
}

export const ListGroup: FC<ListGroupProps> = ({ children }) => {
  return (
    <Flexbox direction="col" className="list-group border border-border-secondary rounded-md">
      {children}
    </Flexbox>
  );
};

export const ListGroupItem: FC<ListGroupItemProps> = ({
  children,
  className = '',
  onClick,
  onAuxClick,
  heading = false,
  last = false,
  first = false,
  ...props
}) => {
  const user = useContext(UserContext);
  const theme = user?.theme || 'default';

  // Determine effective theme for hover effects
  const isDarkMode =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const isClickable = !!(onClick || onAuxClick);

  const itemClasses = classNames(
    'px-1 py-[3px] transition-all duration-200 truncate text-xs',
    {
      'list-group-heading': heading,
      'list-group-card': !heading,
      'font-semibold centered border-b border-border-secondary rounded-t-md': heading,
      'cursor-pointer': isClickable,
      'hover:brightness-125': isClickable && isDarkMode,
      'hover:brightness-90': isClickable && !isDarkMode,
      'rounded-b-md': last,
      'rounded-t-md': first,
    },
    className,
  );

  return (
    <div className={itemClasses} onClick={onClick} onAuxClick={onAuxClick} {...props}>
      {children}
    </div>
  );
};
