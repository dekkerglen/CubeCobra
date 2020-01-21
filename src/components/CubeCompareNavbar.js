import React, { Component } from 'react';

import { Collapse, Nav, NavItem, NavLink, Navbar, NavbarToggler } from 'reactstrap';

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
      isOpen: !isOpen,
    }));
  }

  handleOpenCollapse(event) {
    event.preventDefault();
    const target = event.target;
    const collapse = target.getAttribute('data-target');
    const { setOpenCollapse } = this.props;
    setOpenCollapse((openCollapse) => (openCollapse === collapse ? null : collapse));
  }

  handleOpenTagColorsModal(event) {
    event.preventDefault();
    this.setState({ tagColorsModalOpen: true });
  }

  handleToggleTagColorsModal() {
    this.setState({ tagColorsModalOpen: false });
  }

  render() {
    const { cubeA, cubeAID, cubeB, cubeBID, cards, openCollapse, filter, setFilter } = this.props;
    return (
      <>
        <div className="cubenav">
          <ul className="nav nav-tabs nav-fill mt-3">
            <li className="nav-item">
              <h5 style={{ color: '#218937' }}>Compare Cubes</h5>
              <h6 className="my-3" style={{ color: '#218937' }}>
                <span style={{ color: '#495057' }}>Base Cube:</span>{' '}
                <a href={`/cube/list/${cubeAID}`} className="mr-3" style={{ color: '#218937' }}>
                  {cubeA.name} ({cubeA.card_count} cards)
                </a>{' '}
                <span style={{ color: '#495057' }}>Comparison Cube:</span>{' '}
                <a href={`/cube/list/${cubeBID}`} style={{ color: '#218937' }}>
                  {cubeB.name} ({cubeB.card_count} cards)
                </a>
              </h6>
            </li>
          </ul>
        </div>
        <Navbar expand="md" light className="usercontrols">
          <NavbarToggler onClick={this.toggle} />
          <Collapse isOpen={this.state.isOpen} navbar>
            <Nav navbar>
              <NavItem>
                <NavLink href="#" data-target="sort" onClick={this.handleOpenCollapse}>
                  Sort
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="#" data-target="filter" onClick={this.handleOpenCollapse}>
                  Filter
                </NavLink>
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
        <FilterCollapse
          filter={filter}
          setFilter={setFilter}
          numCards={cards.length}
          isOpen={this.props.openCollapse === 'filter'}
        />
        <TagColorsModal
          canEdit={false}
          isOpen={this.state.tagColorsModalOpen}
          toggle={this.handleToggleTagColorsModal}
        />
      </>
    );
  }
}

export default CubeCompareNavbar;
