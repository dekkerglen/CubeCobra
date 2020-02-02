import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';

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
  Row,
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
  const [isOpen, setIsOpen] = useState(false);
  const [openCollapse, setOpenCollapse] = useState(null);
  const toggle = useCallback(() => setIsOpen((open) => !open), []);

  let dropdownElement = <h5>Default Draft Format</h5>;

  const handleOpenCollapse = useCallback(
    (event) => {
      event.preventDefault();
      const { target } = event;
      const collapse = target.getAttribute('data-target');
      setOpenCollapse((currentCollapse) => (currentCollapse === collapse ? null : collapse));
    },
    [setOpenCollapse],
  );

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
      <Row>
        <Col>
          <h5>{formatId >= 0 ? draftFormats[formatId].title : 'Default Draft Format'}</h5>
        </Col>
        <Col>
          <UncontrolledDropdown nav inNavbar>
            <DropdownToggle nav caret>
              Change Draft Format
            </DropdownToggle>
            <DropdownMenu right>
              <DropdownItem key="default" onClick={() => setFormatId(-1)}>
                Default Draft Format
              </DropdownItem>
              <DropdownItem header key="customformatsheader">
                Custom Formats
              </DropdownItem>
              {draftFormats ? draftFormats.map(dropdownCustomFormat) : ''}
            </DropdownMenu>
          </UncontrolledDropdown>
        </Col>
      </Row>
    );
  }
  return (
    <div className="usercontrols">
      <Navbar expand="md" className="navbar-light">
        <div className="d-flex flex-row flex-nowrap justify-content-between" style={{ flexGrow: 1 }}>
          {dropdownElement}
          <NavbarToggler onClick={toggle} />
        </div>
        <Collapse isOpen={isOpen} navbar>
          <Nav className="ml-auto" navbar>
            <NavItem>
              <NavLink href="#" data-target="filter" onClick={handleOpenCollapse}>
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
        isOpen={openCollapse === 'filter'}
      />
    </div>
  );
};

CubeAnalysisNavBar.propTypes = {
  draftFormats: PropTypes.arrayOf(PropTypes.object).isRequired,
  formatId: PropTypes.number.isRequired,
  setFormatId: PropTypes.func.isRequired,
  filter: PropTypes.string.isRequired,
  setFilter: PropTypes.func.isRequired,
  numCards: PropTypes.number.isRequired,
  defaultFilterText: PropTypes.string.isRequired,
};

export default CubeAnalysisNavBar;
