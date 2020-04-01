import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Collapse, Nav, NavItem, NavLink, Navbar, NavbarToggler, Input } from 'reactstrap';

import FilterCollapse from 'components/FilterCollapse';

const CubeAnalysisNavBar = ({
  draftFormats,
  formatId,
  setFormatId,
  filter,
  setFilter,
  numCards,
  defaultFilterText,
}) => {
  const [navCollapseOpen, setNavCollapse] = useState(false);
  const [filterCollapseOpen, setFilterCollapse] = useState(false);

  return (
    <div className="usercontrols">
      <Navbar expand="md" className="navbar-light">
        <NavbarToggler onClick={() => setNavCollapse(!navCollapseOpen)} />
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
              <NavLink
                href="#"
                onClick={() => {
                  console.log(filterCollapseOpen);
                  setFilterCollapse(!filterCollapseOpen);
                }}
              >
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
