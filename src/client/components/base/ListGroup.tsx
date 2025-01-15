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
    <Flexbox direction="col" className="border border-border-secondary rounded-md">
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

  const itemClasses = classNames(
    'px-1 py-[3px] transition-all duration-200 truncate text-xs',
    {
      'font-semibold centered border-b border-border-secondary rounded-t-md': heading,
      'cursor-pointer hover:brightness-125': (onClick || onAuxClick) && theme === 'dark',
      'cursor-pointer hover:brightness-90': (onClick || onAuxClick) && theme === 'default',
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
