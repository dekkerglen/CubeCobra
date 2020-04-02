import React from 'react';
import PropTypes from 'prop-types';

import { Collapse, Nav, NavItem, NavLink, Navbar, NavbarToggler, Input } from 'reactstrap';

import FilterCollapse from 'components/FilterCollapse';
import useToggle from 'hooks/UseToggle';

const CubeAnalysisNavBar = ({
  draftFormats,
  formatId,
  setFormatId,
  filter,
  setFilter,
  numCards,
  defaultFilterText,
}) => {
  const [navCollapseOpen, toggleNavCollapse] = useToggle(false);
  const [filterCollapseOpen, toggleFilterCollapse] = useToggle(false);

  return (
    <div className="usercontrols">
      <Navbar expand="md" className="navbar-light">
        <NavbarToggler onClick={toggleNavCollapse} />
        <Collapse isOpen={navCollapseOpen} navbar>
          <Nav navbar>
            <h6 className="mt-2">Selected Draft Format:</h6>
            <div className="view-style-select px-2">
              <Input
                type="select"
                id="viewSelect"
                value={formatId}
                onChange={(event) => setFormatId(parseInt(event.target.value, 10))}
              >
                <option value={-1}>Standard Draft</option>
                {draftFormats.map((format, index) => (
                  <option key={format._id} value={index}>
                    {format.title}
                  </option>
                ))}
              </Input>
            </div>
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
  draftFormats: PropTypes.arrayOf(PropTypes.object).isRequired,
  formatId: PropTypes.number.isRequired,
  setFormatId: PropTypes.func.isRequired,
  filter: PropTypes.arrayOf(PropTypes.object).isRequired,
  setFilter: PropTypes.func.isRequired,
  numCards: PropTypes.number.isRequired,
  defaultFilterText: PropTypes.string.isRequired,
};

export default CubeAnalysisNavBar;
