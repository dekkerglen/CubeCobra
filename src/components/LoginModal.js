import React from 'react';
import { Button, Col, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader, Row } from 'reactstrap';

import PropTypes from 'prop-types';

import CSRFForm from 'components/CSRFForm';

const LoginModal = ({ isOpen, toggle, loginCallback }) => (
  <Modal size="lg" isOpen={isOpen} toggle={toggle}>
    <ModalHeader toggle={toggle}>Login</ModalHeader>
    <CSRFForm method="POST" action="/user/login">
      <ModalBody>
        <FormGroup>
          <Row>
            <Col sm="3">
              <Label>Username or Email Address:</Label>
            </Col>
            <Col sm="9">
              <Input maxLength="1000" name="username" id="email" type="text" />
            </Col>
          </Row>
        </FormGroup>
        <FormGroup>
          <Row>
            <Col sm="3">
              <Label>Password:</Label>
            </Col>
            <Col sm="9">
              <Input maxLength="1000" name="password" id="password" type="password" />
            </Col>
          </Row>
          <Row>
            <Col sm="3" />
            <Col sm="9">
              <a href="/user/lostpassword">Forgot password?</a>
            </Col>
          </Row>
        </FormGroup>
        <Input type="hidden" name="loginCallback" value={loginCallback} />
      </ModalBody>
      <ModalFooter>
        <Button type="submit" color="accent" block outline>
          Login
        </Button>
      </ModalFooter>
    </CSRFForm>
  </Modal>
);

LoginModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  loginCallback: PropTypes.string.isRequired,
};

export default LoginModal;
