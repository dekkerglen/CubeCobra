import React, { Component, Fragment } from 'react';
import ReactDOM from 'react-dom';

import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle, Col, FormGroup, Input, Label, Row, UncontrolledAlert, UncontrolledCollapse } from 'reactstrap';

import { csrfFetch } from './util/CSRF';

import DynamicFlash from './components/DynamicFlash';

const range = (lo, hi) => Array.from(Array(hi - lo).keys()).map(n => n + lo);
const rangeOptions = (lo, hi) => range(lo, hi).map(n => <option key={n}>{n}</option>);

const CardTitleH5 = ({ ...props }) => <CardTitle tag="h5" className="mb-0" {...props} />;

const LabelRow = ({ htmlFor, label, children, ...props }) => (
  <FormGroup row {...props}>
    <Label xs="4" md="6" lg="5" htmlFor={htmlFor}>{label}</Label> 
    <Col xs="8" md="6" lg="7">
      {children}
    </Col>
  </FormGroup>
)

const CustomDraftCard = ({ format, index, cubeID, canEdit, deleteFormat, ...props }) => (
  <Card key={format} {...props}>
    <form method="POST" action={`/cube/startdraft/${cubeID}`}>
      <CardHeader>
        <CardTitleH5>
          Draft Custom Format: {format.title}
        </CardTitleH5>
      </CardHeader>
      <CardBody>
        <div className="description-area" dangerouslySetInnerHTML={{__html: format.html}}/>
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
        {!canEdit ? '' : <>
          <Button color="success" className="mr-2 editFormatButton" data-id={index}>
            Edit
          </Button>
          <Button color="danger" id={`deleteToggler-${index}`}>Delete</Button>
          <UncontrolledCollapse toggler={`#deleteToggler-${index}`}>
            <h6 className="my-3">Are you sure? This action cannot be undone.</h6>
            <Button color="danger" onClick={deleteFormat}>
              Yes, delete this format
            </Button>
          </UncontrolledCollapse>
        </>}
      </CardFooter>
    </form>
  </Card>
);

const StandardDraftCard = ({ cubeID }) => (
  <Card className="mt-3">
    <form method="POST" action={`/cube/startdraft/${cubeID}`}>
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
    </form>
  </Card>
);

const DecksCard = ({ decks, cubeID, ...props }) => (
  <Card {...props}>
    <CardHeader>
      <CardTitleH5>Recent Decks</CardTitleH5>
    </CardHeader>
    <CardBody>
      {decks.map(deck =>
        <Fragment key={deck._id}>
          <a href={`/cube/deck/${deck._id}`}>{deck.name}</a>
          <br />
        </Fragment>
      )}
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
          <Button
            color="success"
            disabled={!this.state.seed}
            href={`/cube/samplepack/${cubeID}/${this.state.seed}`}
          >
            View Seeded
              </Button>
        </CardFooter>
      </Card>
    );
  }
}

class CubePlaytest extends Component {
  constructor(props) {
    super(props);

    this.state = {
      alerts: [],
      draftFormats: this.props.draftFormats,
      editModal: false,
    };

    this.addFormat = this.addFormat.bind(this);
    this.deleteFormat = this.deleteFormat.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  toggle() {
    this.setState(({ modal, ...state }) => ({
      ...state,
      modal: !modal,
    }))
  }

  addAlert(data) {
    this.setState(({ alerts }) => ({
      alerts: [].concat(alerts, data),
    }));
  }

  addFormat(format) {
    this.setState(({ draftFormats }) => ({
      draftFormats: [].concat(draftFormats, format),
    }))
  }

  deleteFormat(cube, formatID) {
    console.log(formatID);
    csrfFetch(`/cube/format/remove/${cube};${formatID}`, {
      method: 'DELETE',
    }).then(response => {
      this.addAlert({
        color: 'success',
        children: 'Format successfully deleted.',
      });
      this.setState(({ draftFormats }) => ({
        draftFormats: [].concat(draftFormats.slice(0, formatID), draftFormats.slice(formatID + 1)),
      }));
    }, this.addAlert.bind(this, {
      color: 'danger',
      children: 'Failed to delete format.',
    }));
  }

  handleChange(event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value
    });
  }

  render() {
    const { canEdit, decks, cubeID } = this.props;
    const { alerts, draftFormats } = this.state;

    return <>
      <DynamicFlash />
      {alerts.map(data =>
        <UncontrolledAlert key={data} className="mb-0 mt-3" {...data} />
      )}
      <Row className="justify-content-center">
        <Col xs="12" md="6" xl="5">
          {decks.length == 0 ? '' :
            <DecksCard decks={decks} cubeID={cubeID} className="mt-3" />
          }
          <SamplePackCard cubeID={cubeID} className="mt-3" />
        </Col>
        <Col xs="12" md="6" xl="5">
          {!draftFormats ? '' :
            draftFormats.map((format, index) =>
              <CustomDraftCard
                key={format}
                format={format}
                index={index}
                cubeID={cubeID}
                canEdit={canEdit}
                deleteFormat={this.deleteFormat.bind(this, cubeID, index)}
                className="mt-3"
              />
            )
          }
          <StandardDraftCard cubeID={cubeID} className="mt-3" />
        </Col>
      </Row>
    </>;
  }
}

const canEdit = document.getElementById('canEdit').hasAttribute('value');
const decks = JSON.parse(document.getElementById('deckInput').value || '[]');
const cubeID = document.getElementById('cubeID').value;
const draftFormats = JSON.parse(document.getElementById('draftFormats').value || '[]');
const element = <CubePlaytest canEdit={canEdit} decks={decks} cubeID={cubeID} draftFormats={draftFormats} />;
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(element, wrapper) : false;
