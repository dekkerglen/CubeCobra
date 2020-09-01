import React from 'react';
import PropTypes from 'prop-types';

import { Col, Modal, ModalBody, ModalHeader, Row, FormGroup, Label, Input, Button, ModalFooter } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';

const CreateCubeModal = ({ isOpen, toggle }) => (
  <Modal size="lg" isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>Create New Cube</ModalHeader>
    <CSRFForm method="POST" action="/cube/add">
      <ModalBody>
        <FormGroup>
          <Row>
            <Col sm="3">
              <Label>Cube Name:</Label>
            </Col>
            <Col sm="9">
              <Input maxlength="1000" name="name" type="text" />
            </Col>
          </Row>
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button type="submit" color="success" block outline>
          Create
        </Button>
      </ModalFooter>
    </CSRFForm>
  </Modal>
);

CreateCubeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

export default CreateCubeModal;
