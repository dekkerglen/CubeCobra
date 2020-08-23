import React from 'react';

import { Card, CardBody, FormGroup, Label, Input, Button, Col, Row, CardHeader } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';

const LostPassword = () => (
  <Card className="mt-3">
    <CardHeader>
      <h5>Reset Password</h5>
    </CardHeader>
    <CardBody>
      <CSRFForm method="POST" action="/user/lostpasswordreset">
        <FormGroup>
          <Row>
            <Col sm="4">
              <Label>Email Address:</Label>
            </Col>
            <Col sm="8">
              <Input maxlength="1000" name="email" id="email" type="text" />
            </Col>
          </Row>
        </FormGroup>
        <FormGroup>
          <Row>
            <Col sm="4">
              <Label>Recovery Code:</Label>
            </Col>
            <Col sm="8">
              <Input maxlength="1000" name="code" id="code" type="text" />
            </Col>
          </Row>
        </FormGroup>
        <FormGroup>
          <Row>
            <Col sm="4">
              <Label>New Password:</Label>
            </Col>
            <Col sm="8">
              <Input maxlength="1000" name="password" id="password" type="password" />
            </Col>
          </Row>
        </FormGroup>
        <FormGroup>
          <Row>
            <Col sm="4">
              <Label>Confirm New Password:</Label>
            </Col>
            <Col sm="8">
              <Input maxlength="1000" name="password2" id="confirmPassword" type="password" />
            </Col>
          </Row>
        </FormGroup>
        <Button type="submit" color="success" block outline>
          Change Password
        </Button>
      </CSRFForm>
    </CardBody>
  </Card>
);

export default LostPassword;
