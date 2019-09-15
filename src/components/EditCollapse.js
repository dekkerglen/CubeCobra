import React from 'react';

import { Button, Col, Container, Form, FormGroup, Input, Label, Row, UncontrolledAlert, UncontrolledCollapse } from 'reactstrap';

function saveChanges() {
  $('#changelistBlog').val($('#editor').html());
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

const EditCollapse = props =>
  <UncontrolledCollapse {...props}>
    <Container>
      <Row className="collapse warnings">
        <Col>
          <UncontrolledAlert color="danger">Invalid input: card not recognized.</UncontrolledAlert>
        </Col>
      </Row>
      <Row>
        <Col xs="12" sm="auto">
          <Form inline className="mb-2">
            <div className="autocomplete">
              <Input type="text" className="mr-2" id="addInput" placeholder="Card to Add" />
            </div>
            <Button color="success" onClick={/* global */ justAdd}>Just Add</Button>
          </Form>
        </Col>
        <Col xs="12" sm="auto">
          <Form inline className="mb-2">
            <div className="autocomplete">
              <Input type="text" className="mr-2" id="removeInput" placeholder="Card to Remove" />
            </div>
            <Button color="success" onClick={/* global */ remove}>Remove/Replace</Button>
          </Form>
        </Col>
      </Row>
      <div className="collapse editForm">
        <Form id="changeListForm" method="POST" action={`/cube/edit/${cubeID}`}>
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
                <Input type="textarea" />
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
  </UncontrolledCollapse>;

export default EditCollapse;
