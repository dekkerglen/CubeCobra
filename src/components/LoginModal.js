import PropTypes from 'prop-types';

import { Col, Modal, ModalBody, ModalHeader, Row, FormGroup, Label, Input, Button, ModalFooter } from 'reactstrap';

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
        <Button type="submit" color="success" block outline>
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
