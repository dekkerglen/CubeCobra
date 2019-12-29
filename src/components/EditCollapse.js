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

import ContentEditable from './ContentEditable';
import CSRFForm from './CSRFForm';
import TextEntry from './TextEntry';

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
  document.getElementById('changelistForm').submit();
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
    this.handleAdd = this.handleAdd.bind(this);
    this.handleRemoveReplace = this.handleRemoveReplace.bind(this);
  }

  componentDidMount() {
    /* global */
    /* updateCollapse(); */
  }

  componentDidUpdate() {
    /* global */
    /* updateCollapse(); */
  }

  handlePostChange(event) {
    this.setState({ postContent: event.target.value });
  }

  handleAdd(event) {
    event.preventDefault();
    /* global */ justAdd();
    document.getElementById('addInput').focus();
  }

  handleRemoveReplace(event) {
    event.preventDefault();
    const addInput = document.getElementById('addInput');
    const removeInput = document.getElementById('removeInput');
    const replace = addInput.value.length > 0;
    /* global */ remove();
    /* If replace, put focus back in addInput; otherwise leave it here. */
    (replace ? addInput : removeInput).focus();
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
              <Form inline className="mb-2" onSubmit={this.handleAdd}>
                <div className="autocomplete">
                  <Input
                    type="text"
                    className="mr-2"
                    id="addInput"
                    placeholder="Card to Add"
                    data-button="justAddButton"
                    autoComplete="off"
                    data-lpignore
                  />
                </div>
                <Button color="success" type="submit" id="justAddButton">
                  Just Add
                </Button>
              </Form>
            </Col>
            <Col xs="12" sm="auto">
              <Form inline className="mb-2" onSubmit={this.handleRemoveReplace}>
                <div className="autocomplete">
                  <Input
                    type="text"
                    className="mr-2"
                    id="removeInput"
                    placeholder="Card to Remove"
                    data-button="removeButton"
                    autoComplete="off"
                    data-lpignore
                  />
                </div>
                <Button color="success" type="submit" id="removeButton">
                  Remove/Replace
                </Button>
              </Form>
            </Col>
          </Row>
          <div className="collapse editForm">
            <CSRFForm id="changelistForm" method="POST" action={`/cube/edit/${cubeID}`}>
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
                    <Input type="text" name="title" defaultValue="Cube Updated – Automatic Post" />
                  </FormGroup>
                  <FormGroup>
                    <Label>Body:</Label>
                    <br />
                    <em className="small">To tag cards in post, use '[[cardname]]'. E.g. [[Island]]</em>
                    <TextEntry content={this.state.postContent} handleChange={this.handlePostChange} />
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
          </div>
        </Container>
      </Collapse>
    );
  }
}

export default EditCollapse;
