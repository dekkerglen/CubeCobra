import React from 'react';
import PropTypes from 'prop-types';

import { NavItem, NavLink } from 'reactstrap';

const Tab = ({ tab, setTab, index, children }) => {
  return (
    <NavItem className="ml-2 clickable">
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
Tab.propTypes = {
  tab: PropTypes.string.isRequired,
  setTab: PropTypes.func.isRequired,
  index: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
export default Tab;
