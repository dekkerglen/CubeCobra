import React, { useContext, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Col,
  FormGroup,
  Input,
  Label,
  Nav,
  Navbar,
  NavLink,
  NavItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  UncontrolledCollapse,
} from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';

import CSRFForm from 'components/CSRFForm';
import CubeContext from 'components/CubeContext';
import CustomDraftFormatModal from 'components/CustomDraftFormatModal';
import DynamicFlash from 'components/DynamicFlash';
import DeckPreview from 'components/DeckPreview';
import withModal from 'components/WithModal';
import useAlerts, { Alerts } from 'hooks/UseAlerts';
import CubeLayout from 'layouts/CubeLayout';

const range = (lo, hi) => Array.from(Array(hi - lo).keys()).map((n) => n + lo);
const rangeOptions = (lo, hi) => range(lo, hi).map((n) => <option key={n}>{n}</option>);

const CardTitleH5 = ({ ...props }) => <CardTitle tag="h5" className="mb-0" {...props} />;

const UploadDecklistModal = ({ isOpen, toggle }) => {
  const { cubeID } = useContext(CubeContext);
  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="uploadDecklistModalTitle">
      <CSRFForm method="POST" action={`/cube/uploaddecklist/${cubeID}`}>
        <ModalHeader toggle={toggle} id="uploadDecklistModalTitle">
          Upload Decklist
        </ModalHeader>
        <ModalBody>
          <p>
            Acceptable formats are: one card name per line, or one card name per line prepended with #x, such as
            &quot;2x island&quot;
          </p>
          <Input
            type="textarea"
            maxLength="20000"
            rows="10"
            placeholder="Paste Decklist Here (max length 20000)"
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

UploadDecklistModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

const UploadDecklistModalLink = withModal(NavLink, UploadDecklistModal);

const LabelRow = ({ htmlFor, label, children, ...props }) => (
  <FormGroup row {...props}>
    <Label xs="4" md="6" lg="5" htmlFor={htmlFor}>
      {label}
    </Label>
    <Col xs="8" md="6" lg="7">
      {children}
    </Col>
  </FormGroup>
);

LabelRow.propTypes = {
  htmlFor: PropTypes.string.isRequired,
  label: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
};

const CustomDraftCard = ({
  format,
  onEditFormat,
  onDeleteFormat,
  onSetDefaultFormat,
  defaultDraftFormat,
  ...props
}) => {
  const { cubeID, canEdit } = useContext(CubeContext);
  const { index } = format;
  return (
    <Card {...props}>
      <CSRFForm method="POST" action={`/cube/startdraft/${cubeID}`}>
        <CardHeader>
          <CardTitleH5>
            {format.title} (Custom Draft) {defaultDraftFormat === index && '(Default Format)'}
          </CardTitleH5>
        </CardHeader>
        <CardBody>
          <div
            className="description-area"
            dangerouslySetInnerHTML={/* eslint-disable-line react/no-danger */ { __html: format.html }}
          />
          <LabelRow htmlFor={`seats-${index}`} label="Total Seats" className="mb-0">
            <Input type="select" name="seats" id={`seats-${index}`} defaultValue="8">
              {rangeOptions(4, 17)}
            </Input>
          </LabelRow>
        </CardBody>
        <CardFooter>
          <Input type="hidden" name="id" value={index} />
          <Button type="submit" color="success" className="mr-2">
            Start Draft
          </Button>
          {canEdit && (
            <>
              <Button color="success" className="mr-2" onClick={onEditFormat} data-index={index}>
                Edit
              </Button>
              {defaultDraftFormat !== index && (
                <Button color="success" className="mr-3" onClick={onSetDefaultFormat} data-index={index}>
                  Make Default
                </Button>
              )}
              <Button color="danger" id={`deleteToggler-${index}`}>
                Delete
              </Button>
              <UncontrolledCollapse toggler={`#deleteToggler-${index}`}>
                <h6 className="my-4">Are you sure? This action cannot be undone.</h6>
                <Button color="danger" onClick={onDeleteFormat} data-index={index}>
                  Yes, delete this format
                </Button>
              </UncontrolledCollapse>
            </>
          )}
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

CustomDraftCard.propTypes = {
  format: PropTypes.shape({
    index: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    html: PropTypes.string.isRequired,
  }).isRequired,
  onEditFormat: PropTypes.func.isRequired,
  onDeleteFormat: PropTypes.func.isRequired,
  onSetDefaultFormat: PropTypes.func.isRequired,
  defaultDraftFormat: PropTypes.number.isRequired,
};

const StandardDraftCard = ({ onSetDefaultFormat, defaultDraftFormat }) => {
  const { cubeID, canEdit } = useContext(CubeContext);
  return (
    <Card className="mb-3">
      <CSRFForm method="POST" action={`/cube/startdraft/${cubeID}`}>
        <CardHeader>
          <CardTitleH5>Standard Draft</CardTitleH5>
        </CardHeader>
        <CardBody>
          <LabelRow htmlFor="packs" label="Number of Packs">
            <Input type="select" name="packs" id="packs" defaultValue="3">
              {rangeOptions(1, 11)}
            </Input>
          </LabelRow>
          <LabelRow htmlFor="cards" label="Cards per Pack">
            <Input type="select" name="cards" id="cards" defaultValue="15">
              {rangeOptions(5, 21)}
            </Input>
          </LabelRow>
          <LabelRow htmlFor="seats" label="Total Seats" className="mb-0">
            <Input type="select" name="seats" id="seats" defaultValue="8">
              {rangeOptions(4, 17)}
            </Input>
          </LabelRow>
        </CardBody>
        <CardFooter>
          <Input type="hidden" name="id" value="-1" />
          <Button color="success" className="mr-2">
            Start Draft
          </Button>
          {canEdit && defaultDraftFormat !== -1 && (
            <Button color="success" className="mr-3" onClick={onSetDefaultFormat} data-index={-1}>
              Make Default
            </Button>
          )}
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

StandardDraftCard.propTypes = {
  onSetDefaultFormat: PropTypes.func.isRequired,
  defaultDraftFormat: PropTypes.number.isRequired,
};

const DecksCard = ({ decks, ...props }) => {
  const { cubeID } = useContext(CubeContext);
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitleH5>Recent Decks</CardTitleH5>
      </CardHeader>
      <CardBody className="p-0">
        {decks.map((deck) => (
          <DeckPreview key={deck._id} deck={deck} />
        ))}
      </CardBody>
      <CardFooter>
        <a href={`/cube/decks/${cubeID}`}>View all</a>
      </CardFooter>
    </Card>
  );
};

DecksCard.propTypes = {
  decks: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

const SamplePackCard = (props) => {
  const { cubeID } = useContext(CubeContext);
  const [seed, setSeed] = useState('');
  const handleChange = useCallback((event) => setSeed(event.target.value), []);
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitleH5>View sample pack</CardTitleH5>
      </CardHeader>
      <CardBody>
        <LabelRow htmlFor="seed" label="Seed" className="mb-0">
          <Input type="text" name="seed" id="seed" value={seed} onChange={handleChange} />
        </LabelRow>
      </CardBody>
      <CardFooter>
        <Button color="success" className="mr-2" href={`/cube/samplepack/${cubeID}`}>
          View Random
        </Button>
        <Button color="success" disabled={!seed} href={`/cube/samplepack/${cubeID}/${seed}`}>
          View Seeded
        </Button>
      </CardFooter>
    </Card>
  );
};

const DEFAULT_FORMAT = {
  packs: [['rarity:Mythic', 'tag:new', 'identity>1']],
};
const CubePlaytestPage = ({ cube, cubeID, canEdit, decks, draftFormats }) => {
  const { alerts, addAlert } = useAlerts();
  const [formats, setFormats] = useState(draftFormats);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormatIndex, setEditFormatIndex] = useState(-1);
  const [editFormat, setEditFormat] = useState({});
  const [defaultDraftFormat, setDefaultDraftFormat] = useState(cube.defaultDraftFormat ?? -1);

  const toggleEditModal = useCallback(() => setEditModalOpen((open) => !open), []);

  const handleCreateFormat = useCallback(() => {
    setEditFormat(DEFAULT_FORMAT);
    setEditFormatIndex(-1);
    setEditModalOpen(true);
  }, []);

  const handleEditFormat = useCallback(
    (event) => {
      const formatIndex = parseInt(event.target.getAttribute('data-index'), 10);
      setEditFormat(formats[formatIndex]);
      setEditFormatIndex(formatIndex);
      setEditModalOpen(true);
    },
    [formats],
  );

  const handleDeleteFormat = useCallback(
    async (event) => {
      const formatIndex = parseInt(event.target.getAttribute('data-index'), 10);
      try {
        const response = await csrfFetch(`/cube/format/remove/${cubeID}/${formatIndex}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw Error();

        const json = await response.json();
        if (json.success !== 'true') throw Error();

        addAlert('success', 'Format successfully deleted.');
        setFormats(formats.filter((_, index) => index !== formatIndex));
      } catch (err) {
        console.error(err);
        addAlert('danger', 'Failed to delete format.');
      }
    },
    [addAlert, cubeID, formats],
  );

  const handleSetDefaultFormat = useCallback(
    async (event) => {
      const formatIndex = parseInt(event.target.getAttribute('data-index'), 10);
      try {
        const response = await csrfFetch(`/cube/${cubeID}/defaultdraftformat/${formatIndex}`, {
          method: 'POST',
        });

        if (!response.ok) throw Error();

        const json = await response.json();
        if (json.success !== 'true') throw Error();
        addAlert('success', 'Format successfully set as default.');
        setDefaultDraftFormat(formatIndex);
      } catch (err) {
        console.error(err);
        addAlert('danger', 'Failed to set format as default.');
      }
    },
    [addAlert, cubeID],
  );

  // Sort formats alphabetically.
  const formatsSorted = useMemo(
    () =>
      formats
        .map((format, index) => ({ ...format, index }))
        .sort((a, b) => {
          if (a.index === defaultDraftFormat) {
            return 1;
          }
          if (b.index === defaultDraftFormat) {
            return -1;
          }
          return a.title.localeCompare(b.title);
        }),
    [formats, defaultDraftFormat],
  );

  const StandardDraftFormatCard = () => (
    <StandardDraftCard
      className="mb-3"
      onSetDefaultFormat={handleSetDefaultFormat}
      defaultDraftFormat={defaultDraftFormat}
    />
  );
  return (
    <CubeLayout cube={cube} cubeID={cubeID} canEdit={canEdit} activeLink="playtest">
      {canEdit ? (
        <Navbar light expand className="usercontrols mb-3">
          <Nav navbar>
            <NavItem>
              <NavLink onClick={handleCreateFormat} className="clickable">
                Create Custom Draft
              </NavLink>
            </NavItem>
            <NavItem>
              <UploadDecklistModalLink className="clickable">Upload Decklist</UploadDecklistModalLink>
            </NavItem>
          </Nav>
        </Navbar>
      ) : (
        <Row className="mb-3" />
      )}
      <DynamicFlash />
      <Alerts alerts={alerts} />
      <Row className="justify-content-center">
        <Col xs="12" md="6" xl="6">
          {decks.length !== 0 && <DecksCard decks={decks} cubeID={cubeID} className="mb-3" />}
          <SamplePackCard className="mb-3" />
        </Col>
        <Col xs="12" md="6" xl="6">
          {defaultDraftFormat === -1 && <StandardDraftFormatCard />}
          {formatsSorted.map((format) => (
            <CustomDraftCard
              key={format._id}
              format={format}
              onDeleteFormat={handleDeleteFormat}
              onSetDefaultFormat={handleSetDefaultFormat}
              onEditFormat={handleEditFormat}
              defaultDraftFormat={defaultDraftFormat}
              className="mb-3"
            />
          ))}
          {defaultDraftFormat !== -1 && <StandardDraftFormatCard />}
        </Col>
      </Row>
      <CustomDraftFormatModal
        isOpen={editModalOpen}
        toggle={toggleEditModal}
        formatIndex={editFormatIndex}
        format={editFormat}
        setFormat={setEditFormat}
      />
    </CubeLayout>
  );
};

CubePlaytestPage.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.object),
    defaultDraftFormat: PropTypes.number,
  }).isRequired,
  cubeID: PropTypes.string.isRequired,
  canEdit: PropTypes.bool.isRequired,
  decks: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  draftFormats: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default CubePlaytestPage;
