import React, { useContext, useCallback, useMemo, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import DeckPropType from 'proptypes/DeckPropType';
import UserPropType from 'proptypes/UserPropType';

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
  Spinner,
  UncontrolledCollapse,
} from 'reactstrap';

import CSRFForm from 'components/CSRFForm';
import CubeContext from 'contexts/CubeContext';
import CustomDraftFormatModal from 'components/CustomDraftFormatModal';
import DynamicFlash from 'components/DynamicFlash';
import DeckPreview from 'components/DeckPreview';
import Markdown from 'components/Markdown';
import withModal from 'components/WithModal';
import useAlerts, { Alerts } from 'hooks/UseAlerts';
import useToggle from 'hooks/UseToggle';
import CubeLayout from 'layouts/CubeLayout';
import { csrfFetch } from 'utils/CSRF';
import { allBotsDraft } from 'drafting/draftutil';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const range = (lo, hi) => Array.from(Array(hi - lo).keys()).map((n) => n + lo);
const rangeOptions = (lo, hi) => range(lo, hi).map((n) => <option key={n}>{n}</option>);

const CardTitleH5 = ({ ...props }) => <CardTitle tag="h5" className="mb-0" {...props} />;

const UploadDecklistModal = ({ isOpen, toggle }) => {
  const { cubeID } = useContext(CubeContext);
  return (
    <Modal isOpen={isOpen} toggle={toggle} labelledBy="uploadDecklistModalTitle">
      <CSRFForm method="POST" action={`/cube/deck/uploaddecklist/${cubeID}`}>
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

const useBotsOnlyCallback = (botsOnly, cubeID) => {
  const formRef = useRef();
  const submitDeckForm = useRef();
  const [draftId, setDraftId] = useState('');
  const [loading, setLoading] = useState(false);
  const submitForm = useCallback(
    async (e) => {
      if (botsOnly) {
        setLoading(true);
        e.preventDefault();
        const body = new FormData(formRef.current);
        const response = await csrfFetch(`/cube/startdraft/${cubeID}`, {
          method: 'POST',
          body,
        });

        const json = await response.json();

        setDraftId(json.draft._id);
        const draft = await allBotsDraft(json.draft);

        await csrfFetch(`/cube/api/submitdraft/${draft.cube}`, {
          method: 'POST',
          body: JSON.stringify(draft),
          headers: { 'Content-Type': 'application/json' },
        });

        submitDeckForm.current.submit();
      }
    },
    [botsOnly, cubeID, formRef, setDraftId, submitDeckForm],
  );

  return [submitForm, draftId, submitDeckForm, formRef, loading];
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
  const [botsOnly, toggleBotsOnly] = useToggle(false);
  const [submitForm, draftId, submitDeckForm, formRef, loading] = useBotsOnlyCallback(botsOnly, cubeID);
  return (
    <Card {...props}>
      <CSRFForm
        key="submitdeck"
        className="d-none"
        innerRef={submitDeckForm}
        method="POST"
        action={`/cube/deck/submitdeck/${cubeID}`}
      >
        <Input type="hidden" name="body" value={draftId} />
        <Input type="hidden" name="skipDeckbuilder" value="true" />
      </CSRFForm>
      <CSRFForm
        method="POST"
        key="createDraft"
        action={`/cube/startdraft/${cubeID}`}
        innerRef={formRef}
        onSubmit={submitForm}
      >
        <CardHeader>
          <CardTitleH5>
            {defaultDraftFormat === index && 'Default Format: '}
            {format.title} (Custom Draft)
          </CardTitleH5>
        </CardHeader>
        <CardBody>
          {format.markdown ? (
            <div className="mb-3">
              <Markdown markdown={format.markdown} />
            </div>
          ) : (
            <div
              className="description-area"
              dangerouslySetInnerHTML={/* eslint-disable-line react/no-danger */ { __html: format.html }}
            />
          )}

          <LabelRow htmlFor={`seats-${index}`} label="Total Seats">
            <Input type="select" name="seats" id={`seats-${index}`} defaultValue="8">
              {rangeOptions(2, 17)}
            </Input>
          </LabelRow>
          <FormGroup check>
            <Label check>
              <Input type="checkbox" name="botsOnly" value={botsOnly} onClick={toggleBotsOnly} /> Have just bots draft.
            </Label>
          </FormGroup>
        </CardBody>
        <CardFooter>
          <Input type="hidden" name="id" value={index} />
          <div className="justify-content-center align-items-center">
            {loading && <Spinner className="position-absolute" />}
            <Button type="submit" color="success" className="mr-2" disabled={loading}>
              Start Draft
            </Button>
            {canEdit && (
              <>
                <Button color="success" className="mr-2" onClick={onEditFormat} data-index={index}>
                  Edit
                </Button>
                {defaultDraftFormat !== index && (
                  <Button color="success" className="mr-2" onClick={onSetDefaultFormat} data-index={index}>
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
          </div>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

CustomDraftCard.propTypes = {
  format: PropTypes.shape({
    index: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    html: PropTypes.string,
    markdown: PropTypes.string,
  }).isRequired,
  onEditFormat: PropTypes.func.isRequired,
  onDeleteFormat: PropTypes.func.isRequired,
  onSetDefaultFormat: PropTypes.func.isRequired,
  defaultDraftFormat: PropTypes.number.isRequired,
};

const StandardDraftCard = ({ onSetDefaultFormat, defaultDraftFormat }) => {
  const { cubeID, canEdit } = useContext(CubeContext);
  const [botsOnly, toggleBotsOnly] = useToggle(false);
  const [submitForm, draftId, submitDeckForm, formRef, loading] = useBotsOnlyCallback(botsOnly, cubeID);
  return (
    <Card className="mb-3">
      <CSRFForm
        key="submitdeck"
        className="d-none"
        innerRef={submitDeckForm}
        method="POST"
        action={`/cube/deck/submitdeck/${cubeID}`}
      >
        <Input type="hidden" name="body" value={draftId} />
        <Input type="hidden" name="skipDeckbuilder" value="true" />
      </CSRFForm>
      <CSRFForm method="POST" action={`/cube/startdraft/${cubeID}`} onSubmit={submitForm} innerRef={formRef}>
        <CardHeader>
          <CardTitleH5>{defaultDraftFormat === -1 && 'Default Format: '}Standard Draft</CardTitleH5>
        </CardHeader>
        <CardBody>
          <LabelRow htmlFor="packs" label="Number of Packs">
            <Input type="select" name="packs" id="packs" defaultValue="3">
              {rangeOptions(1, 16)}
            </Input>
          </LabelRow>
          <LabelRow htmlFor="cards" label="Cards per Pack">
            <Input type="select" name="cards" id="cards" defaultValue="15">
              {rangeOptions(1, 25)}
            </Input>
          </LabelRow>
          <LabelRow htmlFor="seats" label="Total Seats">
            <Input type="select" name="seats" id="seats" defaultValue="8">
              {rangeOptions(2, 17)}
            </Input>
          </LabelRow>
          <FormGroup check>
            <Label check>
              <Input type="checkbox" name="botsOnly" onClick={toggleBotsOnly} value={botsOnly} /> Have just bots draft.
            </Label>
          </FormGroup>
        </CardBody>
        <CardFooter>
          <Input type="hidden" name="id" value="-1" />
          <div className="justify-content-center align-items-center">
            {loading && <Spinner className="position-absolute" />}
            <Button color="success" className="mr-2" disabled={loading}>
              Start Draft
            </Button>
          </div>
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

const SealedCard = () => {
  const { cubeID } = useContext(CubeContext);
  return (
    <Card className="mb-3">
      <CSRFForm method="POST" action={`/cube/startsealed/${cubeID}`}>
        <CardHeader>
          <CardTitleH5>Standard Sealed</CardTitleH5>
        </CardHeader>
        <CardBody>
          <LabelRow htmlFor="packs-sealed" label="Number of Packs">
            <Input type="select" name="packs" id="packs-sealed" defaultValue="6">
              {rangeOptions(1, 16)}
            </Input>
          </LabelRow>
          <LabelRow htmlFor="cards-sealed" label="Cards per Pack">
            <Input type="select" name="cards" id="cards-sealed" defaultValue="15">
              {rangeOptions(5, 25)}
            </Input>
          </LabelRow>
        </CardBody>
        <CardFooter>
          <Button color="success">Start Sealed</Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
};

const GridCard = () => {
  const { cubeID } = useContext(CubeContext);
  return (
    <Card className="mb-3">
      <CSRFForm method="POST" action={`/cube/startgriddraft/${cubeID}`}>
        <CardHeader>
          <CardTitleH5>Grid Draft</CardTitleH5>
        </CardHeader>
        <CardBody>
          <div className="description-area">
            <p>Grid drafting is a strategic 2 player draft with completely open information.</p>
          </div>
          <LabelRow htmlFor="packs-grid" label="Number of Packs">
            <Input type="select" name="packs" id="packs-grid" defaultValue="18">
              {rangeOptions(1, 30)}
            </Input>
          </LabelRow>
          <LabelRow htmlFor="type-grid" label="Type">
            <Input type="select" name="type" id="type-grid" defaultValue="18">
              <option value="bot">Against Bot</option>
              <option value="2playerlocal">2 Player Local</option>
            </Input>
          </LabelRow>
        </CardBody>
        <CardFooter>
          <Button color="success">Start Grid Draft</Button>
        </CardFooter>
      </CSRFForm>
    </Card>
  );
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
        <a href={`/cube/deck/decks/${cubeID}`}>View all</a>
      </CardFooter>
    </Card>
  );
};

DecksCard.propTypes = {
  decks: PropTypes.arrayOf(DeckPropType).isRequired,
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
  title: 'Unnamed Format',
  multiples: false,
  markdown: '',
  packs: [{ slots: ['rarity:Mythic', 'tag:new', 'identity>1'], steps: null }],
};
const CubePlaytestPage = ({ user, cube, decks, loginCallback }) => {
  const { alerts, addAlert } = useAlerts();
  const [formats, setFormats] = useState(cube.draft_formats ?? []);
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
        const response = await csrfFetch(`/cube/format/remove/${cube._id}/${formatIndex}`, {
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
    [addAlert, cube._id, formats],
  );

  const handleSetDefaultFormat = useCallback(
    async (event) => {
      const formatIndex = parseInt(event.target.getAttribute('data-index'), 10);
      try {
        const response = await csrfFetch(`/cube/${cube._id}/defaultdraftformat/${formatIndex}`, {
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
    [addAlert, cube._id],
  );

  // Sort formats alphabetically.
  const formatsSorted = useMemo(
    () =>
      formats
        .map((format, index) => ({ ...format, index }))
        .sort((a, b) => {
          if (a.index === defaultDraftFormat) {
            return -1;
          }
          if (b.index === defaultDraftFormat) {
            return 1;
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
    <MainLayout loginCallback={loginCallback}>
      <CubeLayout cube={cube} activeLink="playtest">
        {user && cube.owner === user.id ? (
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
            <SealedCard className="mb-3" />
            <GridCard className="mb-3" />
          </Col>
          <Col xs="12" md="6" xl="6">
            {decks.length !== 0 && <DecksCard decks={decks} className="mb-3" />}
            <SamplePackCard className="mb-3" />
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
    </MainLayout>
  );
};

CubePlaytestPage.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.object),
    defaultDraftFormat: PropTypes.number,
    _id: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    draft_formats: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string,
        multiples: PropTypes.bool,
        markdown: PropTypes.string.isRequired,
        packs: PropTypes.arrayOf(
          PropTypes.shape({
            slots: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
            steps: PropTypes.arrayOf(
              PropTypes.shape({
                action: PropTypes.oneOf(['pass', 'pick', 'trash', 'pickrandom', 'trashrandom']),
                amount: PropTypes.number,
              }),
            ),
          }).isRequired,
        ).isRequired,
      }).isRequired,
    ),
  }).isRequired,
  decks: PropTypes.arrayOf(DeckPropType).isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CubePlaytestPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CubePlaytestPage);
