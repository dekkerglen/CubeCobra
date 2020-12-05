import React, { useCallback, useContext, useState } from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

import {
  Button,
  Collapse,
  Col,
  Container,
  CustomInput,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Form,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Nav,
  NavItem,
  NavLink,
  Navbar,
  NavbarToggler,
  Row,
  UncontrolledDropdown,
} from 'reactstrap';

import CardModalContext from 'components/CardModalContext';
import CSRFForm from 'components/CSRFForm';
import CubeContext from 'components/CubeContext';
import DisplayContext from 'components/DisplayContext';
import EditCollapse from 'components/EditCollapse';
import FilterCollapse from 'components/FilterCollapse';
import GroupModalContext from 'components/GroupModalContext';
import SortCollapse from 'components/SortCollapse';
import SortContext from 'components/SortContext';
import TagColorsModal from 'components/TagColorsModal';
import withModal from 'components/WithModal';

const PasteBulkModal = ({ isOpen, toggle }) => {
  const { cubeID } = useContext(CubeContext);
  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="pasteBulkModalTitle">
      <ModalHeader id="pasteBulkModalTitle" toggle={toggle}>
        Bulk Upload - Paste Text
      </ModalHeader>
      <CSRFForm method="POST" action={`/cube/bulkupload/${cubeID}`}>
        <ModalBody>
          <p>
            Acceptable formats are:
            <br />• one card name per line, or
            <br />• one card name per line prepended with #x, such as &quot;2x island&quot;
          </p>
          <Input
            type="textarea"
            maxLength="20000"
            rows="10"
            placeholder="Paste Cube Here (max length 20000)"
            name="body"
          />
        </ModalBody>
        <ModalFooter>
          <Button color="success" type="submit">
            Upload
          </Button>
          <Button color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

PasteBulkModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

const PasteBulkModalItem = withModal(DropdownItem, PasteBulkModal);

const UploadBulkModal = ({ isOpen, toggle }) => {
  const { cubeID } = useContext(CubeContext);
  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="uploadBulkModalTitle">
      <ModalHeader id="uploadBulkModalTitle" toggle={toggle}>
        Bulk Upload - Upload File
      </ModalHeader>
      <CSRFForm method="POST" action={`/cube/bulkuploadfile/${cubeID}`} encType="multipart/form-data">
        <ModalBody>
          <p>
            Acceptable files are either .txt (plaintext) with one card name per line, or .csv with the same format as
            our .csv export (columns may be ommitted and re-arranged, default values may be used).
          </p>
          <CustomInput type="file" id="uploadBulkFile" name="document" />
          <Label for="uploadBulkFile" className="sr-only">
            Choose file
          </Label>
        </ModalBody>
        <ModalFooter>
          <Button color="success" type="submit">
            Upload
          </Button>
          <Button color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

UploadBulkModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

const UploadBulkModalItem = withModal(DropdownItem, UploadBulkModal);

const UploadBulkReplaceModal = ({ isOpen, toggle }) => {
  const { cubeID } = useContext(CubeContext);
  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="uploadReplacementModalTitle">
      <ModalHeader id="uploadReplacementModalTitle" toggle={toggle}>
        Bulk Upload - Replace with CSV File Upload
      </ModalHeader>
      <CSRFForm method="POST" action={`/cube/bulkreplacefile/${cubeID}`} encType="multipart/form-data">
        <ModalBody>
          <p>
            Replaces all cards in your cube and Maybeboard. Acceptable files are .csv files with the exact format as our
            .csv export.
          </p>
          <CustomInput type="file" id="uploadReplacementFile" name="document" />
          <Label for="uploadReplacementFile" className="sr-only">
            Choose file
          </Label>
        </ModalBody>
        <ModalFooter>
          <Button color="success" type="submit">
            Upload
          </Button>
          <Button color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

UploadBulkReplaceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

const UploadBulkReplaceModalItem = withModal(DropdownItem, UploadBulkReplaceModal);

const CubetutorImportModal = ({ isOpen, toggle }) => {
  const { cubeID } = useContext(CubeContext);
  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="cubetutorImportModalTitle">
      <ModalHeader id="cubetutorImportModalTitle" toggle={toggle}>
        Bulk Upload - Import from Cubetutor
      </ModalHeader>
      <CSRFForm method="POST" action={`/cube/importcubetutor/${cubeID}`}>
        <ModalBody>
          <p>
            Most card versions will be mantained. Some cards with unknown sets will default to the newest printing. Tags
            will not be imported. Cubetutor does not recognize alternate versions of cards with the same name, in the
            same set (e.g. Hymn to Tourach alternate arts, Basic Lands, Everythingamajig). These cards should be checked
            to ensure the desired version has been added.
          </p>
          <InputGroup>
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Cube ID (enter cube id from URL):</InputGroupText>
            </InputGroupAddon>
            {/* FIXME: For some reason hitting enter in this input doesn't submit the form. */}
            <Input type="number" name="cubeid" placeholder="e.g. 123456" />
          </InputGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="success" type="submit">
            Import
          </Button>
          <Button color="secondary" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

CubetutorImportModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

const CubetutorImportModalItem = withModal(DropdownItem, CubetutorImportModal);

const SelectEmptyModal = ({ isOpen, toggle }) => (
  <Modal isOpen={isOpen} toggle={toggle} labelledBy="selectEmptyTitle">
    <ModalHeader id="selectEmptyTitle" toggle={toggle}>
      Cannot Edit Selected
    </ModalHeader>
    <ModalBody>
      <p className="mb-0">
        No cards are selected. To select and edit multiple cards, use the 'List View' and check the desired cards.
      </p>
    </ModalBody>
    <ModalFooter>
      <Button color="secondary" onClick={toggle}>
        Close
      </Button>
    </ModalFooter>
  </Modal>
);

SelectEmptyModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

const CompareCollapse = (props) => {
  const { cubeID } = useContext(CubeContext);
  const [compareID, setCompareID] = useState('');
  const handleChange = useCallback((event) => setCompareID(event.target.value), []);

  const targetUrl = `/cube/compare/${cubeID}/to/${compareID}`;

  return (
    <Collapse {...props}>
      <Container>
        <Row>
          <Col>
            <Form method="GET" action={targetUrl} inline>
              <Input
                type="text"
                className="mb-2 mr-2"
                placeholder="Comparison Cube ID"
                value={compareID}
                onChange={handleChange}
              />
              <Button color="success" className="mb-2" href={targetUrl}>
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
  defaultPrimarySort,
  defaultSecondarySort,
  sorts,
  setSorts,
  defaultSorts,
  defaultFilterText,
  filter,
  setFilter,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tagColorsModalOpen, setTagColorsModalOpen] = useState(false);
  const [selectEmptyModalOpen, setSelectEmptyModalOpen] = useState(false);

  const { canEdit, cubeID, hasCustomImages } = useContext(CubeContext);
  const { groupModalCards, openGroupModal } = useContext(GroupModalContext);
  const { primary, secondary, tertiary } = useContext(SortContext);
  const openCardModal = useContext(CardModalContext);
  const {
    showCustomImages,
    toggleShowCustomImages,
    compressedView,
    toggleCompressedView,
    showMaybeboard,
    toggleShowMaybeboard,
  } = useContext(DisplayContext);

  const toggle = useCallback(() => setIsOpen((open) => !open), []);

  const handleChangeCubeView = useCallback(
    (event) => {
      const { target } = event;
      const { value } = target;
      setCubeView(value);
    },
    [setCubeView],
  );

  const handleMassEdit = useCallback(
    (event) => {
      event.preventDefault();
      if (cubeView === 'list') {
        if (groupModalCards.length === 0) {
          setSelectEmptyModalOpen(true);
        } else if (groupModalCards.length === 1) {
          openCardModal(groupModalCards[0]);
        } else if (groupModalCards.length > 1) {
          openGroupModal();
        }
      } else {
        setCubeView('list');
      }
    },
    [groupModalCards, openCardModal, openGroupModal, cubeView, setCubeView],
  );

  const handleOpenCollapse = useCallback(
    (event) => {
      event.preventDefault();
      const { target } = event;
      const collapse = target.getAttribute('data-target');
      // Avoid shadowing the openCollapse prop
      setOpenCollapse((openCollapseArg) => (openCollapseArg === collapse ? null : collapse));
    },
    [setOpenCollapse],
  );

  const handleOpenTagColorsModal = useCallback(() => setTagColorsModalOpen(true), []);
  const handleToggleTagColorsModal = useCallback(() => setTagColorsModalOpen(false), []);
  const handleToggleSelectEmptyModal = useCallback(() => setSelectEmptyModalOpen(false), []);

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
                {canEdit && (
                  <>
                    <DropdownItem disabled>Import</DropdownItem>
                    <PasteBulkModalItem>Paste Text</PasteBulkModalItem>
                    <UploadBulkModalItem>Upload File</UploadBulkModalItem>
                    <UploadBulkReplaceModalItem>Replace with CSV File Upload</UploadBulkReplaceModalItem>
                    <CubetutorImportModalItem>Import from CubeTutor</CubetutorImportModalItem>
                    <DropdownItem divider />
                    <DropdownItem disabled>Export</DropdownItem>
                  </>
                )}
                <DropdownItem href={`/cube/clone/${cubeID}`}>Clone Cube</DropdownItem>
                <DropdownItem href={`/cube/download/plaintext/${cubeID}`}>Card Names (.txt)</DropdownItem>
                <DropdownItem
                  href={`/cube/download/csv/${cubeID}?primary=${primary}&secondary=${secondary}&tertiary=${tertiary}`}
                >
                  Comma-Separated (.csv)
                </DropdownItem>
                <DropdownItem href={`/cube/download/forge/${cubeID}`}>Forge (.dck)</DropdownItem>
                <DropdownItem href={`/cube/download/mtgo/${cubeID}`}>MTGO (.txt)</DropdownItem>
                <DropdownItem href={`/cube/download/xmage/${cubeID}`}>XMage (.dck)</DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
          </Nav>
        </Collapse>
      </Navbar>
      {!canEdit ? '' : <EditCollapse isOpen={openCollapse === 'edit'} />}
      <SortCollapse
        defaultPrimarySort={defaultPrimarySort}
        defaultSecondarySort={defaultSecondarySort}
        sorts={sorts}
        setSorts={setSorts}
        defaultSorts={defaultSorts}
        isOpen={openCollapse === 'sort'}
      />
      <FilterCollapse
        defaultFilterText={defaultFilterText}
        filter={filter}
        setFilter={setFilter}
        numCards={cards.length}
        isOpen={openCollapse === 'filter'}
      />
      <CompareCollapse isOpen={openCollapse === 'compare'} />
      <TagColorsModal canEdit={canEdit} isOpen={tagColorsModalOpen} toggle={handleToggleTagColorsModal} />
      <SelectEmptyModal isOpen={selectEmptyModalOpen} toggle={handleToggleSelectEmptyModal} />
    </div>
  );
};

CubeListNavbar.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  cubeView: PropTypes.string.isRequired,
  setCubeView: PropTypes.func.isRequired,
  openCollapse: PropTypes.string,
  setOpenCollapse: PropTypes.func.isRequired,
  defaultPrimarySort: PropTypes.string.isRequired,
  defaultSecondarySort: PropTypes.string.isRequired,
  sorts: PropTypes.arrayOf(PropTypes.string),
  setSorts: PropTypes.func.isRequired,
  defaultSorts: PropTypes.arrayOf(PropTypes.string).isRequired,
  defaultFilterText: PropTypes.string.isRequired,
  filter: PropTypes.func,
  setFilter: PropTypes.func.isRequired,
  className: PropTypes.string,
};

CubeListNavbar.defaultProps = {
  openCollapse: null,
  sorts: null,
  filter: null,
  className: null,
};

export default CubeListNavbar;
