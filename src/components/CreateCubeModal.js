import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';

import {
  Col,
  Modal,
  ModalBody,
  ModalHeader,
  Row,
  FormGroup,
  Label,
  Input,
  Button,
  Spinner,
  ModalFooter,
} from 'reactstrap';

import CSRFForm from 'components/CSRFForm';

const CreateCubeModal = ({ isOpen, toggle }) => {
  const [loading, setLoading] = useState(false);
  const formRef = useRef();

  return (
    <Modal size="lg" isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Create New Cube</ModalHeader>
      <CSRFForm ref={formRef} method="POST" action="/cube/add" onSubmit={() => setLoading(true)}>
        <ModalBody>
          <FormGroup>
            <Row>
              <Col sm="3">
                <Label>Cube name:</Label>
              </Col>
              <Col sm="9">
                <Input maxLength="1000" name="name" type="text" />
              </Col>
            </Row>
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          {loading ? (
            <div className="text-center w-100">
              <Spinner />
            </div>
          ) : (
            <Button type="submit" color="accent" block outline disabled={loading}>
              Create
            </Button>
          )}
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

CreateCubeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
};

export default CreateCubeModal;
