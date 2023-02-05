import React, { useCallback, useContext, useState } from 'react';
import PropTypes from 'prop-types';

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
  Nav,
  NavItem,
  NavLink,
  Navbar,
  NavbarToggler,
  UncontrolledDropdown,
  FormGroup,
} from 'reactstrap';

import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import EditCollapse from 'components/EditCollapse';
import FilterCollapse from 'components/FilterCollapse';
import SortCollapse from 'components/SortCollapse';
import TagColorsModal from 'components/TagColorsModal';
import withModal from 'components/WithModal';
import { QuestionIcon } from '@primer/octicons-react';
import PasteBulkModal from 'components/PasteBulkModal';
import UploadBulkModal from 'components/UploadBulkModal';
import UploadBulkReplaceModal from 'components/UploadBulkReplaceModal';
import Tooltip from 'components/Tooltip';

const PasteBulkModalItem = withModal(DropdownItem, PasteBulkModal);
const UploadBulkModalItem = withModal(DropdownItem, UploadBulkModal);
const UploadBulkReplaceModalItem = withModal(DropdownItem, UploadBulkReplaceModal);

const CompareCollapse = (props) => {
  const { cube } = useContext(CubeContext);
  const [compareID, setCompareID] = useState('');
  const handleChange = useCallback((event) => setCompareID(event.target.value), []);

  const targetUrl = `/cube/compare/${cube.id}/to/${compareID}`;

  return (
    <Collapse {...props}>
      <Container>
        <Form method="GET" action={targetUrl} className="row row-cols-lg-auto gx-2">
          <Col xs={12}>
            <Input
              type="text"
              className="mb-2 me-2"
              placeholder="Comparison Cube ID"
              value={compareID}
              onChange={handleChange}
            />
          </Col>
          <Col>
            <Button color="accent" className="mb-2" href={targetUrl}>
              Compare cubes
            </Button>
          </Col>
        </Form>
      </Container>
    </Collapse>
  );
};

const CubeListNavbar = ({ cubeView, setCubeView }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tagColorsModalOpen, setTagColorsModalOpen] = useState(false);
  const [isSortUsed, setIsSortUsed] = useState(true);
  const [isFilterUsed, setIsFilterUsed] = useState(true);

  const {
    canEdit,
    hasCustomImages,
    cube,
    sortPrimary,
    sortSecondary,
    sortTertiary,
    sortQuaternary,
    setShowUnsorted,
    filterInput,
  } = useContext(CubeContext);

  const {
    showCustomImages,
    toggleShowCustomImages,
    compressedView,
    toggleCompressedView,
    showMaybeboard,
    toggleShowMaybeboard,
    openCollapse,
    setOpenCollapse,
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

  const enc = encodeURIComponent;
  const sortUrlSegment = `primary=${enc(sortPrimary)}&secondary=${enc(sortSecondary)}&tertiary=${enc(
    sortTertiary,
  )}&quaternary=${enc(sortQuaternary)}&showother=${enc(cube.showUnsorted)}`;
  const filterUrlSegment = filterInput.length > 0 ? `&filter=${enc(filterInput)}` : '';
  const urlSegment = `${isSortUsed ? sortUrlSegment : ''}${isFilterUsed ? filterUrlSegment : ''}`;

  return (
    <div className="usercontrols">
      <Navbar expand="md" className="navbar-light">
        <div className="d-flex flex-row flex-nowrap justify-content-between" style={{ flexGrow: 1 }}>
          <div className="view-style-select">
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
          <Nav className="ms-auto" navbar>
            {canEdit && (
              <NavItem>
                <NavLink href="#" data-target="edit" onClick={handleOpenCollapse}>
                  Edit
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
            <UncontrolledDropdown nav inNavbar>
              <DropdownToggle nav caret>
                Display
              </DropdownToggle>
              <DropdownMenu end>
                <DropdownItem onClick={handleOpenTagColorsModal}>
                  {canEdit ? 'Set Tag Colors' : 'View Tag Colors'}
                </DropdownItem>
                {hasCustomImages && (
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
                <DropdownItem onClick={() => setShowUnsorted(!cube.showUnsorted)}>
                  {cube.showUnsorted ? 'Hide Unsorted cards' : 'Show Unsorted cards'}
                </DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
            <UncontrolledDropdown nav inNavbar>
              <DropdownToggle nav caret>
                {canEdit ? 'Import/Export' : 'Export'}
              </DropdownToggle>
              <DropdownMenu end>
                {canEdit && (
                  <>
                    <DropdownItem disabled>Import</DropdownItem>
                    <PasteBulkModalItem>Paste Text</PasteBulkModalItem>
                    <UploadBulkModalItem>Upload File</UploadBulkModalItem>
                    <UploadBulkReplaceModalItem>Replace with CSV File Upload</UploadBulkReplaceModalItem>
                    <DropdownItem divider />
                    <DropdownItem disabled>Export</DropdownItem>
                  </>
                )}
                <DropdownItem href={`/cube/clone/${cube.id}`}>Clone Cube</DropdownItem>
                <DropdownItem href={`/cube/download/plaintext/${cube.id}?${urlSegment}`}>
                  Card Names (.txt)
                </DropdownItem>
                <DropdownItem href={`/cube/download/csv/${cube.id}?${urlSegment}`}>Comma-Separated (.csv)</DropdownItem>
                <DropdownItem href={`/cube/download/forge/${cube.id}?${urlSegment}`}>Forge (.dck)</DropdownItem>
                <DropdownItem href={`/cube/download/mtgo/${cube.id}?${urlSegment}`}>MTGO (.txt)</DropdownItem>
                <DropdownItem href={`/cube/download/xmage/${cube.id}?${urlSegment}`}>XMage (.dck)</DropdownItem>
                <DropdownItem divider />
                <DropdownItem toggle={false} onClick={() => setIsSortUsed((is) => !is)}>
                  <FormGroup check style={{ display: 'flex' }}>
                    <Input type="checkbox" className="me-1" checked={isSortUsed} onChange={() => {}} /> Use Sort
                    <Tooltip text="Order export using current sort options." wrapperTag="span" className="ms-auto me-0">
                      <QuestionIcon size={16} />
                    </Tooltip>
                  </FormGroup>
                </DropdownItem>
                <DropdownItem toggle={false} onClick={() => setIsFilterUsed((is) => !is)}>
                  <FormGroup check style={{ display: 'flex' }}>
                    <Input type="checkbox" className="me-1" checked={isFilterUsed} onChange={() => {}} /> Use Filter
                    <Tooltip
                      text="Include in export only cards matching current filter."
                      wrapperTag="span"
                      className="ms-auto me-0"
                    >
                      <QuestionIcon size={16} />
                    </Tooltip>
                  </FormGroup>
                </DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
          </Nav>
        </Collapse>
      </Navbar>
      {canEdit && <EditCollapse isOpen={openCollapse === 'edit'} cubeView={cubeView} />}
      <SortCollapse isOpen={openCollapse === 'sort'} />
      <FilterCollapse isOpen={openCollapse === 'filter'} />
      <CompareCollapse isOpen={openCollapse === 'compare'} />
      <TagColorsModal canEdit={canEdit} isOpen={tagColorsModalOpen} toggle={handleToggleTagColorsModal} />
    </div>
  );
};

CubeListNavbar.propTypes = {
  cubeView: PropTypes.string.isRequired,
  setCubeView: PropTypes.func.isRequired,
};

export default CubeListNavbar;
