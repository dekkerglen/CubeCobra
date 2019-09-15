import React, { Component } from 'react';

import { Collapse, DropdownItem, DropdownMenu, DropdownToggle, Input, Label, Nav, NavItem, NavLink, Navbar, NavbarToggler, UncontrolledDropdown } from 'reactstrap';

class CubeListNavbar extends Component {
  constructor(props) {
    super(props);

    this.state = { isOpen: false };

    this.toggle = this.toggle.bind(this);
    this.handleChangeCubeView = this.handleChangeCubeView.bind(this);
  }

  toggle() {
    this.setState(({ isOpen }) => ({
      isOpen: !isOpen
    }));
  }

  handleChangeCubeView(event) {
    const target = event.target;
    const value = target.value;
    this.props.changeCubeView(value);
  }

  render() {
    const { canEdit, cubeView, cubeID, hasCustomImages } = this.props;
    /* global */
    return (
      <div className="usercontrols">
        <Navbar expand="md" className="navbar-light">
          <div className="view-style-select">
            <Label className="sr-only" for="viewSelect">Cube View Style</Label>
            <Input type="select" id="viewSelect" value={cubeView} onChange={this.handleChangeCubeView}>
              <option value="table">Table View</option>
              <option value="spoiler">Visual Spoiler</option>
              {!canEdit ? '' :
                <option value="list">List View</option>
              }
              <option value="curve">Curve View</option>
            </Input>
          </div>
          <NavbarToggler onClick={this.toggle} />
          <Collapse isOpen={this.state.isOpen} navbar>
            <Nav className="ml-auto" navbar>
              {!canEdit ? '' :
                <NavItem>
                  <NavLink href="#" id="navbarEditLink">Add/Remove</NavLink>
                </NavItem>
              }
              <NavItem>
                <NavLink href="#" id="navbarSortLink">Sort</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="#" id="navbarFilterLink">Filter</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="#" id="navbarCompareLink">Compare</NavLink>
              </NavItem>
              {!canEdit ? '' :
                <NavItem>
                  <NavLink href="#" id="navbarMassEditLink">Mass Edit</NavLink>
                </NavItem>
              }
              <NavItem>
                <NavLink href="#" id="navbarTagColorsLink">
                  {canEdit ? 'Set Tag Colors' : 'View Tag Colors'}
                </NavLink>
              </NavItem>
              {!canEdit ? '' :
                <UncontrolledDropdown nav inNavbar>
                  <DropdownToggle nav caret>Bulk Upload</DropdownToggle>
                  <DropdownMenu right>
                    <DropdownItem data-toggle="modal" data-target="#pasteBulkModal">Paste Text</DropdownItem>
                    <DropdownItem data-toggle="modal" data-target="#uploadBulkModal">Upload File</DropdownItem>
                    <DropdownItem data-toggle="modal" data-target="#importModal">Import from CubeTutor</DropdownItem>
                  </DropdownMenu>
                </UncontrolledDropdown>
              }
              <UncontrolledDropdown nav inNavbar>
                <DropdownToggle nav caret>Export</DropdownToggle>
                <DropdownMenu right>
                  <DropdownItem href={`/cube/download/plaintext/${cubeID}`}>Card Names (.txt)</DropdownItem>
                  <DropdownItem href={`/cube/download/csv/${cubeID}`}>Comma-Separated (.csv)</DropdownItem>
                  <DropdownItem href={`/cube/download/forge/${cubeID}`}>Forge (.dck)</DropdownItem>
                  <DropdownItem href={`/cube/download/xmage/${cubeID}`}>XMage (.dck)</DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
              <NavItem className={hasCustomImages ? undefined : 'd-none'}>
                <NavLink id="customImageDisplayMenuItem" className="d-flex align-items-baseline text-sm-left text-center">
                  <Input type="checkbox" className="mr-1 ml-0 my-0 position-static d-block" id="customImageDisplayToggle" />
                  <Label for="customImageDisplayToggle" className="m-0">Show Custom Images</Label>
                </NavLink>
              </NavItem>
            </Nav>
          </Collapse>
        </Navbar>
      </div>
    );
  }
}

export default CubeListNavbar;
