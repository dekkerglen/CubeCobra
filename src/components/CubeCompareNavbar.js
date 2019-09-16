import React, { Component } from 'react';

import {
  Collapse,
  Nav, NavItem, NavLink, Navbar, NavbarToggler,
} from 'reactstrap';

import FilterCollapse from './FilterCollapse';
import SortCollapse from './SortCollapse';

class CubeCompareNavbar extends Component {
  constructor(props) {
    super(props);

    this.state = { isOpen: false };

    this.toggle = this.toggle.bind(this);
  }

  toggle() {
    this.setState(({ isOpen }) => ({
      isOpen: !isOpen
    }));
  }

  render() {
    return (
      <div className="usercontrols">
        <Navbar expand="md" className="navbar-light">
          <NavbarToggler onClick={this.toggle} />
          <Collapse isOpen={this.state.isOpen} navbar>
            <Nav navbar>
              <NavItem>
                <NavLink href="#" id="navbarSortLink">Sort</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="#" id="navbarFilterLink">Filter</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="#" onClick={/* global */ tagColorsModal}>
                  View Tag Colors
                </NavLink>
              </NavItem>
            </Nav>
          </Collapse>
        </Navbar>
        <SortCollapse toggler="#navbarSortLink" />
        <FilterCollapse toggler="#navbarFilterLink" />
      </div>
    );
  }
}

export default CubeCompareNavbar;
