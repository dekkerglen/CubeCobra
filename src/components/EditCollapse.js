import React, { Component } from 'react';

import {
  Button,
  Card,
  CardHeader,
  Col,
  Collapse,
  Container,
  Form,
  FormGroup,
  Input,
  Label,
  Row,
  UncontrolledAlert,
} from 'reactstrap';

import Changelist from './Changelist';
import ChangelistContext from './ChangelistContext';
import ContentEditable from './ContentEditable';
import CSRFForm from './CSRFForm';

function clickToolbar(event) {
  event.preventDefault();
  const command = event.currentTarget.getAttribute('data-command');
  if (command == 'h5' || command == 'h6') {
    document.execCommand('formatBlock', false, command);
  } else if (command == 'AC') {
    card = /* global */ prompt('Enter the card name here: ', '');
    document.execCommand('insertHTML', false, "<a class='autocard', card='" + card + "'>" + card + '</a>');
    /* global */ autocard_init('autocard');
  } else document.execCommand(command, false, null);
}

const Toolbar = (props) => <div className="toolbar" {...props} />;
const ToolbarItem = (props) => <a href="#" className="toolbar-item" onClick={clickToolbar} {...props} />;

async function getCard(name) {
  if (name && name.length > 0) {
    const normalized = name.replace('?', '-q-');
    while (normalized.includes('//')) {
      normalized = normalized.replace('//', '-slash-');
    }
    const response = await fetch(`/cube/api/getcard/${normalized}`);
    if (!response.ok) {
      throw new Error(`Couldn\'t get card: ${response.status}.`);
    }

    const json = await response.json();
    return json.card;
  }
}

class EditCollapseRaw extends Component {
  constructor(props) {
    super(props);

    this.state = {
      postContent: '',
      add: '',
      remove: '',
    };

    this.addInput = React.createRef();
    this.removeInput = React.createRef();

    this.handlePostChange = this.handlePostChange.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleAdd = this.handleAdd.bind(this);
    this.handleRemoveReplace = this.handleRemoveReplace.bind(this);
    this.handleDiscardAll = this.handleDiscardAll.bind(this);
  }

  handlePostChange(event) {
    this.setState({ postContent: event.target.value });
  }

  handleChange(event) {
    this.setState({
      [event.target.name]: event.target.value,
    });
  }

  async handleAdd(event) {
    const { addChange } = this.props;
    const { add } = this.state;
    const addInput = this.addInput.current;
    event.preventDefault();
    try {
      const card = await getCard(add);
      addChange({ add: card });
      this.setState({ add: '', remove: '' });
      addInput.focus();
    } catch (e) {
      console.error(e);
    }
  }

  async handleRemoveReplace(event) {
    const { addChange } = this.props;
    const { add, remove } = this.state;
    event.preventDefault();
    const addInput = this.addInput.current;
    const removeInput = this.removeInput.current;
    const replace = add.length > 0;
    try {
      const cardOut = await getCard(remove);
      if (replace) {
        const cardIn = await getCard(add);
        addChange({ replace: [cardOut, cardIn] });
      } else {
        addChange({ remove: cardOut });
      }
      this.setState({ add: '', remove: '' });
      /* If replace, put focus back in addInput; otherwise leave it here. */
      (replace ? addInput : removeInput).focus();
    } catch (e) {
      console.error(e);
    }
  }

  handleDiscardAll(event) {
    this.props.setChanges([]);
  }

  render() {
    const { cubeID, changes, addChange, setChanges, ...props } = this.props;
    const { add, remove } = this.state;
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
              <Form inline className="mb-2" onSubmit={this.handleAdd}>
                <div className="autocomplete">
                  <Input
                    type="text"
                    className="mr-2"
                    ref={this.addInput}
                    name="add"
                    value={add}
                    onChange={this.handleChange}
                    placeholder="Card to Add"
                    autoComplete="off"
                    data-lpignore
                  />
                </div>
                <Button color="success" type="submit">Just Add</Button>
              </Form>
            </Col>
            <Col xs="12" sm="auto">
              <Form inline className="mb-2" onSubmit={this.handleRemoveReplace}>
                <div className="autocomplete">
                  <Input
                    type="text"
                    className="mr-2"
                    ref={this.removeInput}
                    name="remove"
                    value={remove}
                    onChange={this.handleChange}
                    placeholder="Card to Remove"
                    autoComplete="off"
                    data-lpignore
                  />
                </div>
                <Button color="success" type="submit">Remove/Replace</Button>
              </Form>
            </Col>
          </Row>
          <Collapse isOpen={changes.length > 0}>
            <CSRFForm id="changelistForm" method="POST" action={`/cube/edit/${cubeID}`}>
              <Row>
                <Col>
                  <Label>Changelist:</Label>
                  <Changelist />
                </Col>
                <Col>
                  <FormGroup>
                    <Label>Blog Title:</Label>
                    <Input type="text" name="title" defaultValue="Cube Updated – Automatic Post" />
                  </FormGroup>
                  <FormGroup>
                    <Label>Body:</Label>
                    <em>To tag cards in post, use '[[cardname]]'. E.g. [[Island]]</em>
                    <Card>
                      <CardHeader className="p-0">
                        <Toolbar>
                          <Row noGutters>
                            <ToolbarItem data-command="bold">
                              <strong>B</strong>
                            </ToolbarItem>
                            <ToolbarItem data-command="italic">
                              <em>I</em>
                            </ToolbarItem>
                            <ToolbarItem data-command="underline">
                              <u>U</u>
                            </ToolbarItem>
                            <ToolbarItem data-command="strikethrough">
                              <s>S</s>
                            </ToolbarItem>
                            <ToolbarItem data-command="h5">
                              <h5>H1</h5>
                            </ToolbarItem>
                            <ToolbarItem data-command="h6">
                              <h6>H2</h6>
                            </ToolbarItem>
                            <ToolbarItem data-command="insertUnorderedList">ul</ToolbarItem>
                            <ToolbarItem data-command="insertOrderedList">ol</ToolbarItem>
                          </Row>
                        </Toolbar>
                      </CardHeader>
                      <ContentEditable id="editor" value={this.state.postContent} onChange={this.handlePostChange} />
                      <Input type="hidden" name="blog" value={this.state.postContent} />
                    </Card>
                  </FormGroup>
                </Col>
              </Row>
              <Row className="mb-2">
                <Col>
                  <Button color="success" className="mr-2" onClick={saveChanges}>
                    Save Changes
                  </Button>
                  <Button color="danger" onClick={discardAll}>
                    Discard All
                  </Button>
                </Col>
              </Row>
            </CSRFForm>
          </Collapse>
        </Container>
      </Collapse>
    );
  }
}

const EditCollapse = (props) =>
  <ChangelistContext.Consumer>
    {({ changes, addChange, setChanges }) =>
      <EditCollapseRaw changes={changes} addChange={addChange} setChanges={setChanges} {...props} />
    }
  </ChangelistContext.Consumer>;

export default EditCollapse;
