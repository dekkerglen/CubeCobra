import React from 'react';
import { Button, Card, CardBody, CardHeader, Col, FormGroup, Input, Label, Row } from 'reactstrap';

import PropTypes from 'prop-types';

import Banner from 'components/Banner';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const LoginPage = ({ loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
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
          <Button type="submit" color="accent" block outline>
            Login
          </Button>
        </CSRFForm>
      </CardBody>
    </Card>
  </MainLayout>
);

LoginPage.propTypes = {
  loginCallback: PropTypes.string,
};

LoginPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(LoginPage);
