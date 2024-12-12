/* eslint-disable react/prop-types */
import React, { Component } from 'react';
import { Collapse, Nav, Navbar, NavbarToggler, NavItem, NavLink } from 'reactstrap';

import Text from 'components/base/Text';
import FilterCollapse from 'components/FilterCollapse';
import TagColorsModal from 'components/modals/TagColorsModal';
import SortCollapse from 'components/SortCollapse';

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

  handleOpenCollapse(event) {
    event.preventDefault();
    const { target } = event;
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

  toggle() {
    this.setState(({ isOpen }) => ({
      isOpen: !isOpen,
    }));
  }

  render() {
    const { isOpen, tagColorsModalOpen } = this.state;
    const { cubeA, cubeAID, cubeB, cubeBID, cards, openCollapse, filter, setFilter } = this.props;
    return (
      <>
        <div className="cubenav">
          <ul className="nav nav-tabs nav-fill pt-2">
            <li className="nav-item">
              <Text semibold md>Compare cubes</Text>
              <Text semibold md>
                <span className="text-muted">Base Cube:</span>{' '}
                <a href={`/cube/list/${cubeAID}`} className="me-3" style={{ color: '#218937' }}>
                  {cubeA.name} ({cubeA.cardCount} cards)
                </a>{' '}
                <span className="text-muted">Comparison Cube:</span>{' '}
                <a href={`/cube/list/${cubeBID}`} style={{ color: '#218937' }}>
                  {cubeB.name} ({cubeB.cardCount} cards)
                </a>
              </Text>
            </li>
          </ul>
        </div>
        <div className="usercontrols">
          <Navbar expand="md" light>
            <NavbarToggler onClick={this.toggle} />
            <Collapse isOpen={isOpen} navbar>
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
            isOpen={openCollapse === 'filter'}
          />
        </div>
        <TagColorsModal canEdit={false} isOpen={tagColorsModalOpen} toggle={this.handleToggleTagColorsModal} />
      </>
    );
  }
}

export default CubeCompareNavbar;
