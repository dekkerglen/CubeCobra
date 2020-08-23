import React from 'react';

import { Card, CardBody, FormGroup, Label, Input, Button, Col, Row, CardHeader } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';

const Login = () => (
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
              <Input maxlength="1000" name="email" id="email" type="text" />
            </Col>
          </Row>
        </FormGroup>
        <FormGroup>
          <Row>
            <Col sm="3">
              <Label>Username:</Label>
            </Col>
            <Col sm="9">
              <Input maxlength="1000" name="username" id="username" type="text" />
            </Col>
          </Row>
        </FormGroup>
        <FormGroup>
          <Row>
            <Col sm="3">
              <Label>Password:</Label>
            </Col>
            <Col sm="9">
              <Input maxlength="1000" name="password" id="password" type="password" />
            </Col>
          </Row>
        </FormGroup>
        <FormGroup>
          <Row>
            <Col sm="3">
              <Label>Confirm Password:</Label>
            </Col>
            <Col sm="9">
              <Input maxlength="1000" name="password2" id="confirmPassword" type="password" />
            </Col>
          </Row>
        </FormGroup>
        <Button type="submit" color="success" block outline>
          Register
        </Button>
      </CSRFForm>
    </CardBody>
  </Card>
);

export default Login;
