import React, { ReactNode } from 'react';
import { NavItem, NavLink } from 'reactstrap';

interface TabProps {
  tab: string;
  setTab: (index: string) => void;
  index: string;
  children: ReactNode;
}

const Tab: React.FC<TabProps> = ({ tab, setTab, index, children }) => {
  return (
    <NavItem className="ms-2 clickable">
      <NavLink
        active={tab === index}
        onClick={() => {
          setTab(index);
        }}
      >
        {children}
      </NavLink>
    </NavItem>
  );
};

export default Tab;
