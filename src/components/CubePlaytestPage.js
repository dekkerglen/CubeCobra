import React, { useContext, useCallback, useRef, useState } from 'react';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Col,
  FormGroup,
  FormText,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
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
import DynamicFlash from './DynamicFlash';
import DeckPreview from './DeckPreview';
import TextEntry from './TextEntry';
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

const CustomDraftFormatModal = ({ isOpen, toggle, formatIndex, format, setFormat }) => {
  const [description, setDescription] = useState('');

  const { cubeID } = useContext(CubeContext);

  const formRef = useRef();

  const handleChangeDescription = useCallback((event) => {
    setDescription(event.target.value);
  })

  const handleAddCard = useCallback(() => {
    const index = parseInt(event.target.getAttribute('data-index'));
    setFormat(format => {
      const newFormat = [...format];
      newFormat[index] = [...newFormat[index], ''];
      return newFormat;
    });
  }, [])
  const handleRemoveCard = useCallback(() => {
    const packIndex = parseInt(event.target.getAttribute('data-pack'));
    const index = parseInt(event.target.getAttribute('data-index'));
    setFormat(format => {
      const newFormat = [...format];
      newFormat[packIndex] = [...newFormat[packIndex]];
      newFormat[packIndex].splice(index, 1);
      return newFormat;
    });
  }, []);
  const handleAddPack = useCallback(() => {
    setFormat(format => [...format, ['']]);
  }, []);
  const handleDuplicatePack = useCallback(() => {
    const index = parseInt(event.target.getAttribute('data-index'));
    setFormat(format => {
      const newFormat = [...format];
      newFormat.splice(index, 0, format[index]);
      return newFormat;
    });
  }, []);
  const handleRemovePack = useCallback((event) => {
    const removeIndex = parseInt(event.target.getAttribute('data-index'));
    setFormat(format => format.filter((_, index) => index !== removeIndex));
  }, []);

  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="customDraftFormatTitle" size="lg">
      <CSRFForm method="POST" action={`/cube/format/add/${cubeID}`} innerRef={formRef}>
        <ModalHeader id="customDraftFormatTitle" toggle={toggle}>Create Custom Draft Format</ModalHeader>
        <ModalBody>
          <Row>
            <Col className="mt-2">
              <Input type="text" maxLength="200" name="title" placeholder="Title" />
            </Col>
            <Col>
              <FormGroup tag="fieldset">
                <FormGroup check>
                  <Label check>
                    <Input type="radio" name="multiples" value="false" defaultChecked={true} />{' '}
                    Don't allow more than one of each card in draft
                  </Label>
                </FormGroup>
                <FormGroup check>
                  <Label check>
                    <Input type="radio" name="multiples" value="true" />{' '}
                    Allow multiples (e.g. set draft)
                  </Label>
                </FormGroup>
              </FormGroup>
            </Col>
          </Row>
          <h6>Description</h6>
          <TextEntry name="html" value={description} onChange={handleChangeDescription} />
          <FormText className="mt-3 mb-1">
            Card slot values can either be single tags (not case sensitive), or a comma separated list of tags to create a
            ratio (e.g. 3:1 rare to mythic could be "rare, rare, rare, mythic"). '*' can be used to match any card.
          </FormText>
          {format.map((pack, index) =>
            <Card key={index} className="mb-3">
              <CardHeader>
                <CardTitle className="mb-0">
                  Pack {index + 1} - {pack.length} Cards
                  <Button close onClick={handleRemovePack} data-index={index} />
                </CardTitle>
              </CardHeader>
              <CardBody>
                {pack.map((card, cardIndex) =>
                  <InputGroup key={cardIndex} className={cardIndex !== 0 ? 'mt-3' : undefined}>
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>{cardIndex}</InputGroupText>
                    </InputGroupAddon>
                    <Input type="text" defaultValue={card} />
                    <InputGroupAddon addonType="append">
                      <Button color="secondary" outline onClick={handleRemoveCard} data-pack={index} data-index={cardIndex}>Remove</Button>
                    </InputGroupAddon>
                  </InputGroup>
                )}
              </CardBody>
              <CardFooter>
                <Button className="mr-2" color="success" onClick={handleAddCard} data-index={index}>Add Card Slot</Button>
                <Button color="success" onClick={handleDuplicatePack} data-index={index}>Duplicate Pack</Button>
              </CardFooter>
            </Card>
          )}
          <Button color="success" onClick={handleAddPack}>
            Add Pack
          </Button>
        </ModalBody>
        <ModalFooter>
          <Input type="hidden" name="packs" value={JSON.stringify(format)} />
          <Input type="hidden" name="id" value={formatIndex} />
          <Button color="success" type="submit">Save</Button>
          <Button color="secondary">
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

const CustomDraftFormatLink = withModal(NavLink, CustomDraftFormatModal);

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
          {canEdit && (<>
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
          </>)}
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
}

const CubePlaytestPage = ({ cubeID, canEdit, decks, draftFormats }) => {
  const [alerts, setAlerts] = useState([]);
  const [formats, setFormats] = useState(draftFormats);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormatIndex, setEditFormatIndex] = useState(-1);
  const [editFormat, setEditFormat] = useState([['Mythic', 'Mythic', 'Mythic']]);

  const addAlert = useCallback((alert) => setAlerts((alerts) => [...alerts, alert]), []);

  const toggleEditModal = useCallback(() => setEditModalOpen(open => !open), []);

  const handleCreateFormat = useCallback((event) => {
    setEditFormat([['Mythic', 'Mythic', 'Mythic']]);
    setEditFormatIndex(-1);
    setEditModalOpen(true);
  })

  const handleEditFormat = useCallback((event) => {
    const formatIndex = parseInt(event.target.getAttribute('data-index'));
    setEditFormat([...formats[formatIndex]]);
    setEditFormatIndex(formatIndex);
    setEditModalOpen(true);
  }, [formats]);

  const handleDeleteFormat = useCallback(async (event) => {
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
    } catch(err) {
      console.error(err);
      addAlert({
        color: 'danger',
        message: 'Failed to delete format.',
      });
    }
  }, [addAlert, cubeID, formats]);

  return (
    <CubeContextProvider cubeID={cubeID} canEdit={canEdit}>
      <Navbar light expand className="usercontrols">
        <Nav navbar>
          <NavItem>
            <NavLink onClick={handleCreateFormat} className="clickable">Create Custom Draft</NavLink>
          </NavItem>
          <NavItem>
            <UploadDecklistModalLink className="clickable">Upload Decklist</UploadDecklistModalLink>
          </NavItem>
        </Nav>
      </Navbar>
      <DynamicFlash />
      {alerts.map(({ color, message }, index) => (
        <UncontrolledAlert key={index} color={color} className="mb-0 mt-3">{message}</UncontrolledAlert>
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
      <CustomDraftFormatModal isOpen={editModalOpen} toggle={toggleEditModal} formatIndex={editFormatIndex} format={editFormat} setFormat={setEditFormat} />
    </CubeContextProvider>
  );
};

export default CubePlaytestPage;
