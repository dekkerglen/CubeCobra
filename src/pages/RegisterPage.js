import React from 'react';
import { Button, Card, CardBody, CardHeader, Col, FormGroup, Input, Label, Row } from 'reactstrap';

import PropTypes from 'prop-types';

import Banner from 'components/Banner';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const RegisterPage = ({ username, email, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
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
                <Label>username:</Label>
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
          <Button type="submit" color="accent" block outline>
            Register
          </Button>
        </CSRFForm>
      </CardBody>
    </Card>
  </MainLayout>
);

RegisterPage.propTypes = {
  email: PropTypes.string,
  username: PropTypes.string,
  loginCallback: PropTypes.string,
};

RegisterPage.defaultProps = {
  loginCallback: '/',
  email: '',
  username: '',
};

export default RenderToRoot(RegisterPage);
