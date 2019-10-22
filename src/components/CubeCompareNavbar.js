import React, { Component } from 'react';

import {
  Collapse,
  Nav, NavItem, NavLink, Navbar, NavbarToggler,
} from 'reactstrap';

import FilterCollapse from './FilterCollapse';
import SortCollapse from './SortCollapse';
import TagColorsModal from './TagColorsModal';

class CubeCompareNavbar extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      tagColorsModalOpen: false,
    };

    this.toggle = this.toggle.bind(this);
    this.handleOpenCollapse = this.handleOpenCollapse.bind(this);
    this.handleOpenTagColorsModal = this.handleOpenTagColorsModal.bind(this);
    this.handleToggleTagColorsModal = this.handleToggleTagColorsModal.bind(this);
  }

  toggle() {
    event.preventDefault();
    this.setState(({ isOpen }) => ({
      isOpen: !isOpen
    }));
  }

  handleOpenCollapse(event) {
    event.preventDefault();
    const target = event.target;
    const collapse = target.getAttribute('data-target');
    const { setOpenCollapse } = this.props;
    setOpenCollapse(openCollapse => openCollapse === collapse ? null : collapse);
  }

  handleOpenTagColorsModal(event) {
    event.preventDefault();
    this.setState({ tagColorsModalOpen: true });
  }

  handleToggleTagColorsModal() {
    this.setState({ tagColorsModalOpen: false });
  }

  render() {
    const { cards, openCollapse, filter, setFilter } = this.props;
    return (
      <div className="usercontrols">
        <Navbar expand="md" className="navbar-light">
          <NavbarToggler onClick={this.toggle} />
          <Collapse isOpen={this.state.isOpen} navbar>
            <Nav navbar>
              <NavItem>
                <NavLink href="#" data-target="sort" onClick={this.handleOpenCollapse}>Sort</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="#" data-target="filter" onClick={this.handleOpenCollapse}>Filter</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="#" onClick={this.handleOpenTagColorsModal}>
                  View Tag Colors
                </NavLink>
              </NavItem>
            </Nav>
          </Collapse>
        </Navbar>
        <SortCollapse isOpen={openCollapse === 'sort'} />
        <FilterCollapse filter={filter} setFilter={setFilter} numCards={cards.length} isOpen={this.props.openCollapse === 'filter'} />
        <TagColorsModal
          canEdit={false}
          isOpen={this.state.tagColorsModalOpen}
          toggle={this.handleToggleTagColorsModal}
        />
      </div>
    );
  }
}

export default CubeCompareNavbar;
