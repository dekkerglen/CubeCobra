import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, FormGroup, Label, Input, Button, Col, Row, CardHeader } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import Advertisement from 'components/Advertisement';

const LoginPage = ({ user, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Advertisement />
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Login</h5>
      </CardHeader>
      <CardBody>
        <CSRFForm method="POST" action="/user/login">
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
          <Button type="submit" color="success" block outline>
            Login
          </Button>
        </CSRFForm>
      </CardBody>
    </Card>
  </MainLayout>
);

LoginPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
};

LoginPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(LoginPage);
