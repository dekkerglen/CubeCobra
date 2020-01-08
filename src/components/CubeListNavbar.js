import React, { useCallback, useContext, useState } from 'react';

import {
  Button,
  Collapse,
  Col,
  Container,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Form,
  Input,
  Label,
  Nav,
  NavItem,
  NavLink,
  Navbar,
  NavbarToggler,
  Row,
  UncontrolledDropdown,
} from 'reactstrap';

import CardModalContext from './CardModalContext';
import CubeContext from './CubeContext';
import DisplayContext from './DisplayContext';
import EditCollapse from './EditCollapse';
import FilterCollapse from './FilterCollapse';
import GroupModalContext from './GroupModalContext';
import SortCollapse from './SortCollapse';
import TagColorsModal from './TagColorsModal';

const CompareCollapse = (props) => {
  const { cubeID } = useContext(CubeContext);
  const [compareID, setCompareID] = useState('');
  const handleChange = useCallback((event) => setCompareID(event.target.value));

  return (
    <Collapse {...props}>
      <Container>
        <Row>
          <Col>
            <Form inline>
              <Input
                type="text"
                className="mb-2 mr-2"
                placeholder="Comparison Cube ID"
                value={compareID}
                onChange={handleChange}
              />
              <Button type="submit" color="success" className="mb-2" href={`/cube/compare/${cubeID}/to/${compareID}`}>
                Compare Cubes
              </Button>
            </Form>
          </Col>
        </Row>
      </Container>
    </Collapse>
  );
};

const CubeListNavbar = ({
  cards,
  cubeView,
  setCubeView,
  openCollapse,
  setOpenCollapse,
  filter,
  setFilter,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tagColorsModalOpen, setTagColorsModalOpen] = useState(false);

  const { canEdit, cubeID, hasCustomImages } = useContext(CubeContext);
  const { groupModalCards, setGroupModalCards, openGroupModal } = useContext(GroupModalContext);
  const openCardModal = useContext(CardModalContext);
  const {
    showCustomImages,
    toggleShowCustomImages,
    compressedView,
    toggleCompressedView,
    showMaybeboard,
    toggleShowMaybeboard,
  } = useContext(DisplayContext);

  const toggle = useCallback(() => setIsOpen((open) => !open));

  const handleChangeCubeView = useCallback(
    (event) => {
      const target = event.target;
      const value = target.value;
      setCubeView(value);
    },
    [setCubeView],
  );

  const handleMassEdit = useCallback(
    (event) => {
      event.preventDefault();
      const cards = groupModalCards;
      if (cubeView === 'list') {
        if (cards.length === 1) {
          openCardModal(cards[0].index);
        } else if (cards.length > 1) {
          openGroupModal();
        }
      } else {
        setCubeView('list');
      }
    },
    [groupModalCards, openCardModal, openGroupModal, setCubeView],
  );

  const handleOpenCollapse = useCallback(
    (event) => {
      event.preventDefault();
      const target = event.target;
      const collapse = target.getAttribute('data-target');
      setOpenCollapse((openCollapse) => (openCollapse === collapse ? null : collapse));
    },
    [setOpenCollapse],
  );

  const handleOpenTagColorsModal = useCallback((event) => setTagColorsModalOpen(true));
  const handleToggleTagColorsModal = useCallback((event) => setTagColorsModalOpen(false));

  return (
    <div className={`usercontrols${className ? ` ${className}` : ''}`}>
      <Navbar expand="md" className="navbar-light">
        <div className="d-flex flex-row flex-nowrap justify-content-between" style={{ flexGrow: 1 }}>
          <div className="view-style-select">
            <Label className="sr-only" for="viewSelect">
              Cube View Style
            </Label>
            <Input type="select" id="viewSelect" value={cubeView} onChange={handleChangeCubeView}>
              <option value="table">Table View</option>
              <option value="spoiler">Visual Spoiler</option>
              {!canEdit ? '' : <option value="list">List View</option>}
              <option value="curve">Curve View</option>
            </Input>
          </div>
          <NavbarToggler onClick={toggle} />
        </div>
        <Collapse isOpen={isOpen} navbar>
          <Nav className="ml-auto" navbar>
            {!canEdit ? (
              ''
            ) : (
              <NavItem>
                <NavLink href="#" data-target="edit" onClick={handleOpenCollapse}>
                  Add/Remove
                </NavLink>
              </NavItem>
            )}
            <NavItem>
              <NavLink href="#" data-target="sort" onClick={handleOpenCollapse}>
                Sort
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" data-target="filter" onClick={handleOpenCollapse}>
                Filter
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="#" data-target="compare" onClick={handleOpenCollapse}>
                Compare
              </NavLink>
            </NavItem>
            {!canEdit ? (
              ''
            ) : (
              <NavItem className={cubeView === 'list' ? undefined : 'd-none d-lg-block'}>
                <NavLink href="#" onClick={handleMassEdit}>
                  {cubeView === 'list' ? 'Edit Selected' : 'Mass Edit'}
                </NavLink>
              </NavItem>
            )}
            <UncontrolledDropdown nav inNavbar>
              <DropdownToggle nav caret>
                Display
              </DropdownToggle>
              <DropdownMenu right>
                <DropdownItem onClick={handleOpenTagColorsModal}>
                  {canEdit ? 'Set Tag Colors' : 'View Tag Colors'}
                </DropdownItem>
                {!hasCustomImages && (
                  <DropdownItem onClick={toggleShowCustomImages}>
                    {showCustomImages ? 'Hide Custom Images' : 'Show Custom Images'}
                  </DropdownItem>
                )}
                <DropdownItem onClick={toggleCompressedView}>
                  {compressedView ? 'Disable Compressed View' : 'Enable Compressed View'}
                </DropdownItem>
                <DropdownItem onClick={toggleShowMaybeboard}>
                  {showMaybeboard ? 'Hide Maybeboard' : 'Show Maybeboard'}
                </DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
            <UncontrolledDropdown nav inNavbar>
              <DropdownToggle nav caret>
                {canEdit ? 'Import/Export' : 'Export'}
              </DropdownToggle>
              <DropdownMenu right>
                {!canEdit && (
                  <>
                    <DropdownItem disabled>Import</DropdownItem>
                    <DropdownItem data-toggle="modal" data-target="#pasteBulkModal">
                      Paste Text
                    </DropdownItem>
                    <DropdownItem data-toggle="modal" data-target="#uploadBulkModal">
                      Upload File
                    </DropdownItem>
                    <DropdownItem data-toggle="modal" data-target="#importModal">
                      Import from CubeTutor
                    </DropdownItem>
                    <DropdownItem divider />
                    <DropdownItem disabled>Export</DropdownItem>
                  </>
                )}
                <DropdownItem href={`/cube/download/plaintext/${cubeID}`}>Card Names (.txt)</DropdownItem>
                <DropdownItem href={`/cube/download/csv/${cubeID}`}>Comma-Separated (.csv)</DropdownItem>
                <DropdownItem href={`/cube/download/forge/${cubeID}`}>Forge (.dck)</DropdownItem>
                <DropdownItem href={`/cube/download/xmage/${cubeID}`}>XMage (.dck)</DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
          </Nav>
        </Collapse>
      </Navbar>
      {!canEdit ? '' : <EditCollapse cubeID={cubeID} isOpen={openCollapse === 'edit'} />}
      <SortCollapse isOpen={openCollapse === 'sort'} />
      <FilterCollapse
        filter={filter}
        setFilter={setFilter}
        numCards={cards.length}
        isOpen={openCollapse === 'filter'}
      />
      <CompareCollapse isOpen={openCollapse === 'compare'} />
      <TagColorsModal canEdit={canEdit} isOpen={tagColorsModalOpen} toggle={handleToggleTagColorsModal} />
    </div>
  );
};

export default CubeListNavbar;
