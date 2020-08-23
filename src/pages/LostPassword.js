import React from 'react';

import { Card, CardBody, FormGroup, Label, Input, Button, Col, Row, CardHeader } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';

const LostPassword = () => (
  <Card className="mt-3">
    <CardHeader>
      <h5>Recover Password</h5>
    </CardHeader>
    <CardBody>
      <p>
        To recover your password, provide the email associated with the account. A password reset link will be emailed
        to you.
      </p>
      <CSRFForm method="POST" action="/user/lostpassword">
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
        <Button type="submit" color="success" block outline>
          Continue
        </Button>
      </CSRFForm>
    </CardBody>
  </Card>
);

export default LostPassword;
