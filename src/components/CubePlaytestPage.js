import React, { Component, useContext, useCallback } from 'react';

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
  FormText,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from 'reactstrap';

import { csrfFetch } from '../util/CSRF';

import CSRFForm from './CSRFForm';
import CubeContext, { CubeContextProvider } from './CubeContext';
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
            maxlength="20000"
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

const CustomDraftFormatModal = ({ isOpen, toggle, format, setFormat }) => {
  const { cubeID } = useContext(CubeContext);

  const handleAddPack = useCallback(() => {
    setFormat(format => [...format, ['']]);
  }, []);
  const handleAddCard = useCallback(() => {
    const index = event.target.getAttribute('data-index');
    setFormat(format => {
      const newFormat = [...format];
      newFormat[index] = [...newFormat[index], ''];
      return newFormat;
    });
  }, [])
  const handleDuplicatePack = useCallback(() => {
    const index = event.target.getAttribute('data-index');
    setFormat(format => {
      const newFormat = [...format];
      newFormat.splice(index, 0, format[index])];
      return newFormat;
    });
  }, []);
  const handleRemovePack = useCallback((event) => {
    const removeIndex = event.target.getAttribute('data-index');
    setFormat(format => format.filter((_, index) => index !== removeIndex));
  }, []);

  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="customDraftFormatTitle">
      <CSRFForm method="POST" action={`/cube/format/add/${cubeID}`}>
        <ModalHeader id="customDraftFormatTitle">Create Custom Draft Format</ModalHeader>
        <ModalBody>
          <Row>
            <Col>
              <Label>Title:</Label>
              <Input type="text" maxlength="200" name="title" />
            </Col>
            <Col>
              <FormGroup tag="fieldset">
                <FormGroup check>
                  <Label check>
                    <Input type="radio" name="multiples" value="false" />{' '}
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
          <Label>Description:</Label>
          <Input type="hidden" name="html" />
          <FormText>
            Card values can either be single tags (not case sensitive), or a comma separated list of tags to create a
            ratio (e.g. 3:1 rare to mythic could be "rare, rare, rare, mythic"). '*' can be used to match any card.
          </FormText>
          {format.map((pack, index) =>
            <Card>
              <CardHeader>
                <CardTitle>Pack {index} - {pack.length} Cards</CardTitle>
                <Button close onClick={removePack} data-index={index} />
              </CardHeader>
              <CardBody>
                {pack.map((card, cardIndex) =>
                  <InputGroup>
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>{cardIndex}</InputGroupText>
                    </InputGroupAddon>
                    <Input type="text" />
                    <InputGroupAddon addonType="append">
                      <Button color="secondary" outline>Remove</Button>
                    </InputGroupAddon>
                  </InputGroup>
                )}
              </CardBody>
              <CardFooter>
                <Button color="success" onClick={handleAddCard} data-index={index}>Add Card Slot</Button>
                <Button color="success" onClick={handleDuplicatePack} data-index={index}>Duplicate Pack</Button>
              </CardFooter>
            </Card>
          )}
          <Button color="success" onClick={handleAddPack} data-index={index}>
            Add Pack
          </Button>
        </ModalBody>
        <ModalFooter>
          <Input type="hidden" name="format" value={format} />
          <Input type="hidden" name="id" />
          <Button color="success" type="submit">Save</Button>
          <Button color="secondary">
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

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

const CustomDraftCard = ({ format, index, cubeID, canEdit, deleteFormat, ...props }) => (
  <Card key={format} {...props}>
    <CSRFForm method="POST" action={`/cube/startdraft/${cubeID}`}>
      <CardHeader>
        <CardTitleH5>Draft Custom Format: {format.title}</CardTitleH5>
      </CardHeader>
      <CardBody>
        <div className="description-area" dangerouslySetInnerHTML={{ __html: format.html }} />
        <LabelRow htmlFor={`seats-${index}`} label="Total Seats" className="mb-0">
          <Input type="select" name="seats" id={`seats-${index}`} defaultValue="8">
            {rangeOptions(4, 11)}
          </Input>
        </LabelRow>
      </CardBody>
      <CardFooter>
        <Input type="hidden" name="id" value={index} />
        <Button type="submit" color="success" className="mr-2">
          Start Draft
        </Button>
        {!canEdit ? (
          ''
        ) : (
          <>
            <Button color="success" className="mr-2 editFormatButton" data-id={index}>
              Edit
            </Button>
            <Button color="danger" id={`deleteToggler-${index}`}>
              Delete
            </Button>
            <UncontrolledCollapse toggler={`#deleteToggler-${index}`}>
              <h6 className="my-3">Are you sure? This action cannot be undone.</h6>
              <Button color="danger" onClick={deleteFormat}>
                Yes, delete this format
              </Button>
            </UncontrolledCollapse>
          </>
        )}
      </CardFooter>
    </CSRFForm>
  </Card>
);

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

class SamplePackCard extends Component {
  constructor(props) {
    super(props);

    this.state = { seed: '' };

    this.changeSeed = this.changeSeed.bind(this);
  }

  changeSeed(e) {
    this.setState({
      seed: e.target.value,
    });
  }

  render() {
    const { cubeID, ...props } = this.props;
    return (
      <Card {...props}>
        <CardHeader>
          <CardTitleH5>View sample pack</CardTitleH5>
        </CardHeader>
        <CardBody>
          <LabelRow htmlFor="seed" label="Seed" className="mb-0">
            <Input type="text" name="seed" id="seed" value={this.state.seed} onChange={this.changeSeed} />
          </LabelRow>
        </CardBody>
        <CardFooter>
          <Button color="success" className="mr-2" href={`/cube/samplepack/${cubeID}`}>
            View Random
          </Button>
          <Button color="success" disabled={!this.state.seed} href={`/cube/samplepack/${cubeID}/${this.state.seed}`}>
            View Seeded
          </Button>
        </CardFooter>
      </Card>
    );
  }
}

const CubePlaytestPage = ({ cubeID, canEdit, decks, draftFormats }) => {
  const [alerts, setAlerts] = useState([]);
  const [formats, setFormats] = useState(draftFormats);

  const addAlert = useCallback((alert) => setAlerts((alerts) => [...alerts, alert]), []);

  const handleDeleteFormat = useCallback(async (event) => {
    const formatIndex = event.target.getAttribute('data-index');
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
    } catch(err) {
      console.error(err);
      addAlert({
        color: 'danger',
        message: 'Failed to delete format.',
      });
    }
  }, [addAlert, cubeID]);

  const handleChange = useCallback((event) => {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value,
    });
  });

  render() {
    const { alerts, draftFormats } = this.state;

    return (
      <CubeContextProvider cubeID={cubeID} canEdit={canEdit}>
        <Navbar light expand className="usercontrols">
          <Nav navbar>
            <NavItem>
              <NavLink>Create Custom Draft</NavLink>
            </NavItem>
            <NavItem>
              <UploadDecklistModalLink className="clickable">Upload Decklist</UploadDecklistModalLink>
            </NavItem>
          </Nav>
        </Navbar>
        <DynamicFlash />
        {alerts.map((data) => (
          <UncontrolledAlert key={data} className="mb-0 mt-3" {...data} />
        ))}
        <Row className="justify-content-center">
          <Col xs="12" md="6" xl="6">
            {decks.length == 0 ? '' : <DecksCard decks={decks} cubeID={cubeID} className="mt-3" />}
            <SamplePackCard cubeID={cubeID} className="mt-3" />
          </Col>
          <Col xs="12" md="6" xl="6">
            {!draftFormats
              ? ''
              : draftFormats.map((format, index) => (
                  <CustomDraftCard
                    key={format}
                    format={format}
                    index={index}
                    cubeID={cubeID}
                    canEdit={canEdit}
                    deleteFormat={this.deleteFormat.bind(this, cubeID, index)}
                    className="mt-3"
                  />
                ))}
            <StandardDraftCard cubeID={cubeID} className="mt-3" />
          </Col>
        </Row>
      </CubeContextProvider>
    );
  }
}

export default CubePlaytestPage;
