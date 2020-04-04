import React from 'react';
import PropTypes from 'prop-types';

import { Collapse, Nav, NavItem, NavLink, Navbar, NavbarToggler } from 'reactstrap';

import FilterCollapse from 'components/FilterCollapse';
import useToggle from 'hooks/UseToggle';

const CubeAnalysisNavBar = ({ filter, setFilter, numCards, defaultFilterText }) => {
  const [navCollapseOpen, toggleNavCollapse] = useToggle(false);
  const [filterCollapseOpen, toggleFilterCollapse] = useToggle(false);

  return (
    <div className="usercontrols">
      <Navbar expand="md" className="navbar-light">
        <NavbarToggler onClick={toggleNavCollapse} />
        <Collapse isOpen={navCollapseOpen} navbar>
          <Nav navbar>
            <NavItem>
              <NavLink href="#" onClick={toggleFilterCollapse}>
                Filter
              </NavLink>
            </NavItem>
          </Nav>
        </Collapse>
      </Navbar>
      <FilterCollapse
        defaultFilterText={defaultFilterText}
        filter={filter}
        setFilter={setFilter}
        numCards={numCards}
        isOpen={filterCollapseOpen}
      />
    </div>
  );
};

CubeAnalysisNavBar.propTypes = {
  filter: PropTypes.arrayOf(PropTypes.object).isRequired,
  setFilter: PropTypes.func.isRequired,
  numCards: PropTypes.number.isRequired,
  defaultFilterText: PropTypes.string.isRequired,
};

export default CubeAnalysisNavBar;
