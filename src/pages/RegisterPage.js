import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, FormGroup, Label, Input, Button, Col, Row, CardHeader } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';
import Advertisement from 'components/Advertisement';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const RegisterPage = ({ user, username, email, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Advertisement />
    <DynamicFlash />
    <Card className="mt-3">
      <CardHeader>
        <h5>Register</h5>
      </CardHeader>
      <CardBody>
        <CSRFForm method="POST" action="/user/register">
          <FormGroup>
            <Row>
              <Col sm="3">
                <Label>Email Address:</Label>
              </Col>
              <Col sm="9">
                <Input maxLength="1000" name="email" id="email" type="text" defaultValue={email} />
              </Col>
            </Row>
          </FormGroup>
          <FormGroup>
            <Row>
              <Col sm="3">
                <Label>Username:</Label>
              </Col>
              <Col sm="9">
                <Input maxLength="1000" name="username" id="username" type="text" defaultValue={username} />
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
          </FormGroup>
          <FormGroup>
            <Row>
              <Col sm="3">
                <Label>Confirm Password:</Label>
              </Col>
              <Col sm="9">
                <Input maxLength="1000" name="password2" id="confirmPassword" type="password" />
              </Col>
            </Row>
          </FormGroup>
          <Button type="submit" color="success" block outline>
            Register
          </Button>
        </CSRFForm>
      </CardBody>
    </Card>
  </MainLayout>
);

RegisterPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  email: PropTypes.string,
  username: PropTypes.string,
  loginCallback: PropTypes.string,
};

RegisterPage.defaultProps = {
  user: null,
  loginCallback: '/',
  email: '',
  username: '',
};

export default RenderToRoot(RegisterPage);
