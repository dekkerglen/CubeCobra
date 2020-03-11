import React from 'react';
import PropTypes from 'prop-types';

import useToggle from 'hooks/UseToggle';

import {
  Collapse,
  Col,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Nav,
  NavItem,
  NavLink,
  Navbar,
  NavbarToggler,
  UncontrolledDropdown,
} from 'reactstrap';

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
  const [isOpen, , toggleIsOpen] = useToggle(false);
  const [filterCollapseOpen, , toggleFilterCollapseOpen] = useToggle(false);

  let dropdownElement = <h5>Standard Draft Format</h5>;

  const dropdownCustomFormat = (format, formatIndex) => (
    <DropdownItem
      key={/* eslint-disable-line react/no-array-index-key */ `format-${formatIndex}`}
      onClick={() => setFormatId(formatIndex)}
    >
      {format.title}
    </DropdownItem>
  );

  if (draftFormats) {
    dropdownElement = (
      <Col>
        <h5>{formatId >= 0 ? `${draftFormats[formatId].title} (Custom Draft)` : 'Standard Draft Format'}</h5>
        <UncontrolledDropdown inNavbar>
          <DropdownToggle nav caret>
            Change Draft Format
          </DropdownToggle>
          <DropdownMenu right>
            <DropdownItem key="default" onClick={() => setFormatId(-1)}>
              Standard Draft Format
            </DropdownItem>
            <DropdownItem header key="customformatsheader">
              Custom Formats
            </DropdownItem>
            {draftFormats ? draftFormats.map(dropdownCustomFormat) : ''}
          </DropdownMenu>
        </UncontrolledDropdown>
      </Col>
    );
  }
  return (
    <div className="usercontrols">
      <Navbar expand="md" className="navbar-light">
        <div className="d-flex flex-row flex-nowrap justify-content-between" style={{ flexGrow: 1 }}>
          {dropdownElement}
          <NavbarToggler onClick={toggleIsOpen} />
        </div>
        <Collapse isOpen={isOpen} navbar>
          <Nav className="ml-auto" navbar>
            <NavItem>
              <NavLink href="#" data-target="filter" onClick={toggleFilterCollapseOpen}>
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
