import React, { Component } from 'react';

import { Button, Card, CardHeader, Col, Collapse, Container, Form, FormGroup, Input, Label, Row, UncontrolledAlert } from 'reactstrap';

import ContentEditable from './ContentEditable';

function clickToolbar(event) {
  event.preventDefault();
  const command = event.currentTarget.getAttribute('data-command');
  if (command == 'h5' || command == 'h6') {
    document.execCommand('formatBlock', false, command);
  } else if (command == 'AC') {
    card = /* global */ prompt('Enter the card name here: ', '');
    document.execCommand('insertHTML', false, "<a class='autocard', card='" + card + "'>" + card + "</a>");
    /* global */ autocard_init('autocard');
  } else document.execCommand(command, false, null);
}

const Toolbar = props =>
  <div className="toolbar" {...props} />;
const ToolbarItem = props =>
  <a href="#" className="toolbar-item" onClick={clickToolbar} {...props} />;

function saveChanges() {
  var val = '';
  changes.forEach(function(change, index) {
    if (index != 0) {
      val += ';';
    }
    if (change.add) {
      val += '+' + change.add._id;
    } else if (change.remove) {
      val += '-' + change.remove._id;
    } else if (change.replace) {
      val += '/' + change.replace[0]._id + '>';
      val += change.replace[1]._id;
    }
  });
  $('#changelistFormBody').val(val);
  document.getElementById("changelistForm").submit();
}

function discardAll() {
  changes = [];
  updateCollapse();
}

class EditCollapse extends Component {
  constructor(props) {
    super(props);

    this.state = {
      postContent: '',
    };

    this.handlePostChange = this.handlePostChange.bind(this);
  }

  componentDidMount() {
    /* global */
    updateCollapse();
  }

  componentDidUpdate() {
    /* global */
    updateCollapse();
  }

  handlePostChange(event) {
    this.setState({ postContent: event.target.value });
  }

  render() {
    const { cubeID, ...props } = this.props;
    return (
      <Collapse {...props}>
        <Container>
          <Row className="collapse warnings">
            <Col>
              <UncontrolledAlert color="danger">Invalid input: card not recognized.</UncontrolledAlert>
            </Col>
          </Row>
          <Row>
            <Col xs="12" sm="auto">
              <Form inline className="mb-2" onSubmit={e => e.preventDefault()}>
                <div className="autocomplete">
                  <Input type="text" className="mr-2" id="addInput" placeholder="Card to Add" autoComplete="off" />
                </div>
                <Button color="success" onClick={/* global */ justAdd}>Just Add</Button>
              </Form>
            </Col>
            <Col xs="12" sm="auto">
              <Form inline className="mb-2" onSubmit={e => e.preventDefault()}>
                <div className="autocomplete">
                  <Input type="text" className="mr-2" id="removeInput" placeholder="Card to Remove" autoComplete="off" />
                </div>
                <Button color="success" onClick={/* global */ remove}>Remove/Replace</Button>
              </Form>
            </Col>
          </Row>
          <div className="collapse editForm">
            <Form id="changelistForm" method="POST" action={`/cube/edit/${cubeID}`}>
              <Row>
                <Col>
                  <Label>Changelist:</Label>
                  <div className="editarea">
                    <p className="editlist" id="changelist" />
                  </div>
                </Col>
                <Col>
                  <FormGroup>
                    <Label>Blog Title:</Label>
                    <Input type="text" defaultValue="Cube Updated – Automatic Post" />
                  </FormGroup>
                  <FormGroup>
                    <Label>Body:</Label>
                    <em>To tag cards in post, use '[[cardname]]'. E.g. [[Island]]</em>
                    <Card>
                      <CardHeader className="p-0">
                        <Toolbar>
                          <Row noGutters>
                            <ToolbarItem data-command='bold'><strong>B</strong></ToolbarItem>
                            <ToolbarItem data-command='italic'><em>I</em></ToolbarItem>
                            <ToolbarItem data-command='underline'><u>U</u></ToolbarItem>
                            <ToolbarItem data-command='strikethrough'><s>S</s></ToolbarItem>
                            <ToolbarItem data-command='h5'><h5>H1</h5></ToolbarItem>
                            <ToolbarItem data-command='h6'><h6>H2</h6></ToolbarItem>
                            <ToolbarItem data-command='insertUnorderedList'>ul</ToolbarItem>
                            <ToolbarItem data-command='insertOrderedList'>ol</ToolbarItem>
                          </Row>
                        </Toolbar>
                      </CardHeader>
                      <ContentEditable
                        id="editor"
                        value={this.state.postContent}
                        onChange={this.handlePostChange}
                      />
                      <Input type="hidden" name="blog" value={this.state.postContent} />
                      <Input type="hidden" id="changelistFormBody" name="body" />
                    </Card>
                  </FormGroup>
                </Col>
              </Row>
              <Row className="mb-2">
                <Col>
                  <Button color="success" className="mr-2" onClick={saveChanges}>Save Changes</Button>
                  <Button color="danger" onClick={discardAll}>Discard All</Button>
                </Col>
              </Row>
            </Form>
          </div>
        </Container>
      </Collapse>
    );
  }
}

export default EditCollapse;
