import React, { useContext, useCallback, useState } from 'react';

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
  UncontrolledAlert,
  UncontrolledCollapse,
} from 'reactstrap';

import { csrfFetch } from '../util/CSRF';

import CSRFForm from './CSRFForm';
import CubeContext, { CubeContextProvider } from './CubeContext';
import CustomDraftFormatModal from './CustomDraftFormatModal';
import DynamicFlash from './DynamicFlash';
import DeckPreview from './DeckPreview';
import withModal from './WithModal';

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
            Acceptable formats are: one card name per line, or one card name per line prepended with #x, such as "2x
            island"
          </p>
          <Input
            type="textarea"
            maxLength="20000"
            rows="10"
            placeholder="Paste Decklist Here (max length 20000)"
            name="body"
          ></Input>
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

const CustomDraftCard = ({ format, formatIndex, onEditFormat, onDeleteFormat, ...props }) => {
  const { cubeID, canEdit } = useContext(CubeContext);
  return (
    <Card {...props}>
      <CSRFForm method="POST" action={`/cube/startdraft/${cubeID}`}>
        <CardHeader>
          <CardTitleH5>Draft Custom Format: {format.title}</CardTitleH5>
        </CardHeader>
        <CardBody>
          <div className="description-area" dangerouslySetInnerHTML={{ __html: format.html }} />
          <LabelRow htmlFor={`seats-${formatIndex}`} label="Total Seats" className="mb-0">
            <Input type="select" name="seats" id={`seats-${formatIndex}`} defaultValue="8">
              {rangeOptions(4, 11)}
            </Input>
          </LabelRow>
        </CardBody>
        <CardFooter>
          <Input type="hidden" name="id" value={formatIndex} />
          <Button type="submit" color="success" className="mr-2">
            Start Draft
          </Button>
          {canEdit && (
            <>
              <Button color="success" className="mr-2" onClick={onEditFormat} data-index={formatIndex}>
                Edit
              </Button>
              <Button color="danger" id={`deleteToggler-${formatIndex}`}>
                Delete
              </Button>
              <UncontrolledCollapse toggler={`#deleteToggler-${formatIndex}`}>
                <h6 className="my-3">Are you sure? This action cannot be undone.</h6>
                <Button color="danger" onClick={onDeleteFormat} data-index={formatIndex}>
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

const StandardDraftCard = ({ cubeID }) => (
  <Card className="mt-3">
    <CSRFForm method="POST" action={`/cube/startdraft/${cubeID}`}>
      <CardHeader>
        <CardTitleH5>Start a new draft</CardTitleH5>
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
            {rangeOptions(4, 11)}
          </Input>
        </LabelRow>
      </CardBody>
      <CardFooter>
        <Input type="hidden" name="id" value="-1" />
        <Button color="success">Start Draft</Button>
      </CardFooter>
    </CSRFForm>
  </Card>
);

const DecksCard = ({ decks, cubeID, ...props }) => (
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

const CubePlaytestPage = ({ cubeID, canEdit, decks, draftFormats }) => {
  const [alerts, setAlerts] = useState([]);
  const [formats, setFormats] = useState(draftFormats);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormatIndex, setEditFormatIndex] = useState(-1);
  const [editFormat, setEditFormat] = useState([['Mythic', 'Mythic', 'Mythic']]);

  const addAlert = useCallback((alert) => setAlerts((alerts) => [...alerts, alert]), []);

  const toggleEditModal = useCallback(() => setEditModalOpen((open) => !open), []);

  const handleCreateFormat = useCallback((event) => {
    setEditFormat([['Mythic', 'Mythic', 'Mythic']]);
    setEditFormatIndex(-1);
    setEditModalOpen(true);
  });

  const handleEditFormat = useCallback(
    (event) => {
      const formatIndex = parseInt(event.target.getAttribute('data-index'));
      setEditFormat([...formats[formatIndex]]);
      setEditFormatIndex(formatIndex);
      setEditModalOpen(true);
    },
    [formats],
  );

  const handleDeleteFormat = useCallback(
    async (event) => {
      const formatIndex = parseInt(event.target.getAttribute('data-index'));
      try {
        const response = await csrfFetch(`/cube/format/remove/${cubeID};${formatIndex}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw Error();

        const json = await response.json();
        if (json.success !== 'true') throw Error();

        addAlert({
          color: 'success',
          message: 'Format successfully deleted.',
        });
        console.log('deleting', formatIndex);
        setFormats(formats.filter((format, index) => index !== formatIndex));
      } catch (err) {
        console.error(err);
        addAlert({
          color: 'danger',
          message: 'Failed to delete format.',
        });
      }
    },
    [addAlert, cubeID, formats],
  );

  return (
    <CubeContextProvider cubeID={cubeID} canEdit={canEdit}>
      <Navbar light expand className="usercontrols">
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
      <DynamicFlash />
      {alerts.map(({ color, message }, index) => (
        <UncontrolledAlert key={index} color={color} className="mb-0 mt-3">
          {message}
        </UncontrolledAlert>
      ))}
      <Row className="justify-content-center">
        <Col xs="12" md="6" xl="6">
          {decks.length == 0 ? '' : <DecksCard decks={decks} cubeID={cubeID} className="mt-3" />}
          <SamplePackCard className="mt-3" />
        </Col>
        <Col xs="12" md="6" xl="6">
          {formats.map((format, index) => (
            <CustomDraftCard
              key={format}
              format={format}
              formatIndex={index}
              onDeleteFormat={handleDeleteFormat}
              onEditFormat={handleEditFormat}
              className="mt-3"
            />
          ))}
          <StandardDraftCard cubeID={cubeID} className="mt-3" />
        </Col>
      </Row>
      <CustomDraftFormatModal
        isOpen={editModalOpen}
        toggle={toggleEditModal}
        formatIndex={editFormatIndex}
        format={editFormat}
        setFormat={setEditFormat}
      />
    </CubeContextProvider>
  );
};

export default CubePlaytestPage;
