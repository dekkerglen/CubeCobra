import React, { Component } from 'react';

import {
  Button,
  Collapse,
  Col,
  Container,
  DropdownItem, DropdownMenu, DropdownToggle,
  Form, FormGroup, Input, Label,
  InputGroup, InputGroupAddon, InputGroupText,
  Nav, NavItem, NavLink, Navbar, NavbarToggler,
  Row,
  UncontrolledAlert, UncontrolledCollapse, UncontrolledDropdown
} from 'reactstrap';

import SortContext from './SortContext';

const EditCollapse = props =>
  <UncontrolledCollapse {...props}>
    <Container>
      <Row className="collapse warnings">
        <Col>
          <UncontrolledAlert color="danger">Invalid input: card not recognized.</UncontrolledAlert>
        </Col>
      </Row>
      <Row>
        <Col xs="12" sm="6">
          <Form inline className="mb-2">
            <Input className="text" id="addInput" placeholder="Card to Add" />
            <Button color="success" id="justAddButton">Just Add</Button>
          </Form>
        </Col>
        <Col xs="12" sm="6">
          <Form inline className="mb-2">
            <Input className="text" id="removeInput" placeholder="Card to Remove" />
            <Button color="success" id="removeButton">Remove/Replace</Button>
          </Form>
        </Col>
      </Row>
      <div className="collapse editForm">
        <Form id="changeListForm" method="POST" action={`/cube/edit/${cubeID}`}>
          <Row>
            <Col>
              <Label>Changelist:</Label>
              <div className="editarea">
                <p className="editlist" id="changelist" />
              </div>
            </Col>
            <Col>
              <FormGroup>
                <Label>Blog Title:</Label>
                <Input type="text" />
              </FormGroup>
              <FormGroup>
                <Label>Body:</Label>
                <Input type="textarea" />
              </FormGroup>
            </Col>
          </Row>
          <Row>
            <Col>
              <Button color="success" id="saveChangesButton">Save Changes</Button>
              <Button color="danger" id="discardAllButton">Discard All</Button>
            </Col>
          </Row>
        </Form>
      </div>
    </Container>
  </UncontrolledCollapse>

const FilterCollapse = props =>
  <UncontrolledCollapse {...props}>
    <Container>
      <Row>
        <Col>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText htmlFor="filterInput">Filter</InputGroupText>
            </InputGroupAddon>
            <Input type="text" id="filterInput" placeholder={'name:"Ambush Viper"'} />
            <InputGroupAddon addonType="append">
              <Button color="success" id="filterButton">Apply</Button>
            </InputGroupAddon>
          </InputGroup>
          <h5>Filters</h5>
          <div id="filterarea" />
        </Col>
      </Row>
      <Row>
        <Col>
          <Button color="success" id="resetButton" className="mr-sm-2 mb-3">Reset Filters</Button>
          <Button color="success" id="advancedSearchButton" className="mr-sm-2 mb-3" data-toggle="#filterModal">
            Advanced Search
          </Button>
          <Button color="success" className="mr-sm-2 mb-3" href="/filters">Syntax Guide</Button>
        </Col>
      </Row>
    </Container>
  </UncontrolledCollapse>;

const SortCollapse = props =>
  <UncontrolledCollapse {...props}>
    <SortContext.Consumer>
      {({ primary, secondary, changeSort }) =>
        <Container>
          <Row>
            <Col xs="12" sm="6" className="mt-2">
              <h6>Primary Sort</h6>
              <Input type="select" value={primary} onChange={e => changeSort({ primary: e.target.value })}>
                {getSorts().map(sort => <option key={sort}>{sort}</option>)}
              </Input>
            </Col>
            <Col xs="12" sm="6" className="mt-2">
              <h6>Secondary Sort</h6>
              <Input type="select" value={secondary} onChange={e => changeSort({ secondary: e.target.value })}>
                {getSorts().map(sort => <option key={sort}>{sort}</option>)}
              </Input>
            </Col>
          </Row>
          <Row>
            <Col>
              <p className="my-2"><em>
                Cards will be appear as duplicates if they fit in multiple categories.
                The counts will still only count each item once.
              </em></p>
            </Col>
          </Row>
          <Row className="mb-3">
            {!canEdit ? '' :
              <Col>
                <Button color="success" id="saveSortButton">Save as Default Sort</Button>
              </Col>
            }
          </Row>
        </Container>
      }
    </SortContext.Consumer>
  </UncontrolledCollapse>;

class CubeListNavbar extends Component {
  constructor(props) {
    super(props);

    this.state = { isOpen: false };

    this.toggle = this.toggle.bind(this);
    this.handleChangeCubeView = this.handleChangeCubeView.bind(this);
    this.handleMassEdit = this.handleMassEdit.bind(this);
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
    if (this.props.cubeView === 'list') {
      groupSelect = cube.filter(card => card.checked);
      if (groupSelect.length === 0) {
        $('#selectEmptyModal').modal('show');
      } else if (groupSelect.length === 1) {
        card = groupSelect[0];
        show_contextModal(card);
      } else {
        show_groupContextModal();
      }
    } else {
      this.props.changeCubeView('list');
    }
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
                  <NavLink href="#" onClick={this.handleMassEdit}>
                    {cubeView === 'list' ? 'Edit Selected' : 'Mass Edit'}
                  </NavLink>
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
        {!canEdit ? '' :
          <EditCollapse toggler="#navbarEditLink" />
        }
        <SortCollapse toggler="#navbarSortLink" />
        <FilterCollapse toggler="#navbarFilterLink" />
      </div>
    );
  }
}

export default CubeListNavbar;
