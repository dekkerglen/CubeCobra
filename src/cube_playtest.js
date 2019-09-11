import React, { Component, Fragment } from 'react';
import ReactDOM from 'react-dom';

import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle, Col, FormGroup, Input, Label, Row } from 'reactstrap';

const range = (lo, hi) => Array.from(Array(hi - lo).keys()).map(n => n + lo);
const rangeOptions = (lo, hi) => range(lo, hi).map(n => <option key={n}>{n}</option>);

const CardTitleH5 = ({ ...props }) => <CardTitle tag="h5" className="mb-0" {...props} />;

const LabelRow = ({ label, children, ...props }) => (
  <FormGroup row {...props}>
    <Label xs="4" md="6" lg="5" for={props['for']}>{label}</Label> 
    <Col xs="8" md="6" lg="7">
      {children}
    </Col>
  </FormGroup>
)

class CubePlaytest extends Component {
  render() {
    const { canEdit, decks, cubeID } = this.props;

    return <>
      <Row className="justify-content-center">
        <Col xs="12" md="6" xl="5">
          {decks.length == 0 ? '' :
            <Card className="mt-3">
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
          }
          <Card className="mt-3">
            <CardHeader>
              <CardTitleH5>View sample pack</CardTitleH5>
            </CardHeader>
            <CardBody>
              <LabelRow for="seed" label="Seed" className="mb-0">
                <Input type="text" name="seed" id="seed" />
              </LabelRow>
            </CardBody>
            <CardFooter>
              <Button color="success" className="mr-2" href={`/cube/samplepack/${cubeID}`}>
                View Random
              </Button>
              <Button color="success" href={`/cube/samplepack/${cubeID}`}>
                View Seeded
              </Button>
            </CardFooter>
          </Card>
        </Col>
        <Col xs="12" md="6" xl="5">
          {!draftFormats ? '' :
            draftFormats.map(format =>
              <Card key={format._id} className="mt-3">
                <CardHeader>
                  <CardTitleH5>
                    Draft Custom Format: {format.title}
                  </CardTitleH5>
                </CardHeader>
                <CardBody>
                  <div className="description-area">{format.html}</div>
                  <LabelRow for={`seats-${format._id}`} label="Total Seats" className="mb-0">
                    <Input type="select" name="seats" id={`seats-${format._id}`} defaultValue="8">
                      {rangeOptions(4, 11)}
                    </Input>
                  </LabelRow>
                </CardBody>
                <CardFooter>
                  <Button color="success" className="mr-2">Start Draft</Button>
                  {!canEdit ? '' : <>
                    <Button color="success" className="mr-2">Edit</Button>
                    <Button color="danger" id="deleteToggler">Delete</Button>
                    <UncontrolledCollapse toggler="#deleteToggler">
                      Are you sure? This action cannot be undone.
                      <Button color="danger">Yes, delete this format</Button>
                    </UncontrolledCollapse>
                  </>}
                </CardFooter>
              </Card>
            )
          }
          <Card className="mt-3">
            <CardHeader>
              <CardTitleH5>Start a new draft</CardTitleH5>
            </CardHeader>
            <CardBody>
              <LabelRow for="packs" label="Number of Packs">
                <Input type="select" name="packs" id="packs" defaultValue="3">
                  {rangeOptions(1, 11)}
                </Input>
              </LabelRow>
              <LabelRow for="cards" label="Cards per Pack">
                <Input type="select" name="cards" id="cards" defaultValue="15">
                  {rangeOptions(5, 21)}
                </Input>
              </LabelRow>
              <LabelRow for="seats" label="Total Seats" className="mb-0">
                <Input type="select" name="seats" id="seats" defaultValue="8">
                  {rangeOptions(4, 11)}
                </Input>
              </LabelRow>
            </CardBody>
            <CardFooter>
              <Button color="success">Start Draft</Button>
            </CardFooter>
          </Card>
        </Col>
      </Row>
    </>;
  }
}

const canEdit = document.getElementById('canEdit').value === 'true';
const decks = JSON.parse(document.getElementById('deckInput').value);
const cubeID = document.getElementById('cubeID').value;
const draftFormats = JSON.parse(document.getElementById('draftFormats').value);
const element = <CubePlaytest canEdit={canEdit} decks={decks} cubeID={cubeID} draftFormats={draftFormats} />;
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(element, wrapper) : false;
