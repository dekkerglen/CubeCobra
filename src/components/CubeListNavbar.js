import React, { Component } from 'react';

import {
  Button,
  Collapse,
  Col,
  Container,
  DropdownItem, DropdownMenu, DropdownToggle,
  Form, Input, Label,
  Nav, NavItem, NavLink, Navbar, NavbarToggler,
  Row,
  UncontrolledDropdown
} from 'reactstrap';

import CardModalContext from './CardModalContext';
import DisplayContext from './DisplayContext';
import EditCollapse from './EditCollapse';
import FilterCollapse from './FilterCollapse';
import GroupModalContext from './GroupModalContext';
import SortCollapse from './SortCollapse';

// FIXME: Bring into React
function compare(event) {
  event.preventDefault();
  const id_a = $('#cubeID').val();
  let id_b = $('#compareInput').val();
  if (id_b.includes('/')) {
    let parts = id_b.split('/');
    id_b = parts[parts.length - 1];
  }
  if (id_b) window.location.href = '/cube/compare/' + id_a + '/to/' + id_b;
}

const CompareCollapse = props =>
  <Collapse {...props}>
    <Container>
      <Row>
        <Col>
          <Form inline onSubmit={compare}>
            <Input type="text" id="compareInput" className="mb-2 mr-2" placeholder="Comparison Cube ID"/>
            <Button type="submit" color="success" className="mb-2">
              Compare Cubes
            </Button>
          </Form>
        </Col>
      </Row>
    </Container>
  </Collapse>;

class CubeListNavbarRaw extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
    };

    this.toggle = this.toggle.bind(this);
    this.handleChangeCubeView = this.handleChangeCubeView.bind(this);
    this.handleMassEdit = this.handleMassEdit.bind(this);
    this.handleOpenCollapse = this.handleOpenCollapse.bind(this);
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

  handleMassEdit(event) {
    // This is full of globals and needs to be restructured.
    event.preventDefault();
    const cards = this.props.groupModalCards;
    if (this.props.cubeView === 'list') {
      if (cards.length === 1) {
        this.props.openCardModal(cards[0]);
      } else if (cards.length > 1) {
        this.props.openGroupModal();
      }
    } else {
      this.props.changeCubeView('list');
    }
  }

  handleOpenCollapse(event) {
    event.preventDefault();
    const target = event.target;
    const collapse = target.getAttribute('data-target');
    const { setOpenCollapse } = this.props;
    setOpenCollapse(openCollapse => openCollapse === collapse ? null : collapse);
  }

  render() {
    const { canEdit, cubeView, cubeID, hasCustomImages, filter, setFilter, cards } = this.props;
    /* global */
    return (
      <div className="usercontrols">
        <Navbar expand="md" className="navbar-light">
          <div className="d-flex flex-row flex-nowrap justify-content-between" style={{ flexGrow: 1 }}>
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
          </div>
          <Collapse isOpen={this.state.isOpen} navbar>
            <Nav className="ml-auto" navbar>
              {!canEdit ? '' :
                <NavItem>
                  <NavLink href="#" data-target="edit" onClick={this.handleOpenCollapse}>Add/Remove</NavLink>
                </NavItem>
              }
              <NavItem>
                <NavLink href="#" data-target="sort" onClick={this.handleOpenCollapse}>Sort</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="#" data-target="filter" onClick={this.handleOpenCollapse}>Filter</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href="#" data-target="compare" onClick={this.handleOpenCollapse}>Compare</NavLink>
              </NavItem>
              {!canEdit ? '' :
                <NavItem className={cubeView === 'list' ? undefined : 'd-none d-lg-block'}>
                  <NavLink href="#" onClick={this.handleMassEdit}>
                    {cubeView === 'list' ? 'Edit Selected' : 'Mass Edit'}
                  </NavLink>
                </NavItem>
              }
              <UncontrolledDropdown nav inNavbar>
                <DropdownToggle nav caret>Display</DropdownToggle>
                <DropdownMenu right>
                  <DropdownItem onClick={/* global */ tagColorsModal}>
                    {canEdit ? 'Set Tag Colors' : 'View Tag Colors'}
                  </DropdownItem>
                  <DisplayContext.Consumer>
                    {({ showCustomImages, toggleShowCustomImages }) => !hasCustomImages ? '' :
                      <DropdownItem onClick={toggleShowCustomImages}>
                        {showCustomImages ? 'Hide Custom Images' : 'Show Custom Images'}
                      </DropdownItem>
                    }
                  </DisplayContext.Consumer>
                </DropdownMenu>
              </UncontrolledDropdown>
              <UncontrolledDropdown nav inNavbar>
                <DropdownToggle nav caret>{canEdit ? 'Import/Export' : 'Export'}</DropdownToggle>
                <DropdownMenu right>
                  {!canEdit ? '' : <>
                    <DropdownItem disabled>Export</DropdownItem>
                    <DropdownItem data-toggle="modal" data-target="#pasteBulkModal">Paste Text</DropdownItem>
                    <DropdownItem data-toggle="modal" data-target="#uploadBulkModal">Upload File</DropdownItem>
                    <DropdownItem data-toggle="modal" data-target="#importModal">Import from CubeTutor</DropdownItem>
                    <DropdownItem divider />
                    <DropdownItem disabled>Import</DropdownItem>
                  </>}
                  <DropdownItem href={`/cube/download/plaintext/${cubeID}`}>Card Names (.txt)</DropdownItem>
                  <DropdownItem href={`/cube/download/csv/${cubeID}`}>Comma-Separated (.csv)</DropdownItem>
                  <DropdownItem href={`/cube/download/forge/${cubeID}`}>Forge (.dck)</DropdownItem>
                  <DropdownItem href={`/cube/download/xmage/${cubeID}`}>XMage (.dck)</DropdownItem>
                </DropdownMenu>
              </UncontrolledDropdown>
            </Nav>
          </Collapse>
        </Navbar>
        {!canEdit ? '' :
          <EditCollapse cubeID={cubeID} isOpen={this.props.openCollapse === 'edit'} />
        }
        <SortCollapse isOpen={this.props.openCollapse === 'sort'} />
        <FilterCollapse filter={filter} setFilter={setFilter} numCards={cards.length} isOpen={this.props.openCollapse === 'filter'} />
        <CompareCollapse isOpen={this.props.openCollapse === 'compare'} />
      </div>
    );
  }
}

const CubeListNavbar = props =>
  <GroupModalContext.Consumer>
    {({ groupModalCards, setGroupModalCards, openGroupModal }) =>
      <CardModalContext.Consumer>
        {openCardModal =>
          <CubeListNavbarRaw
            {...{ groupModalCards, setGroupModalCards, openGroupModal, openCardModal }}
            {...props}
          />
        }
      </CardModalContext.Consumer>
    }
  </GroupModalContext.Consumer>

export default CubeListNavbar;
