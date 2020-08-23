import React from 'react';

import { Card, CardBody, FormGroup, Label, Input, Button, Col, Row, CardHeader } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';

const Login = () => (
  <Card className="mt-3">
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
              <Input maxlength="1000" name="username" id="email" type="text" />
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
);

export default Login;
