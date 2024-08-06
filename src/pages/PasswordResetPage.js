import React from 'react';
import { Button, Card, CardBody, CardHeader, Col, FormGroup, Input, Label, Row } from 'reactstrap';

import PropTypes from 'prop-types';

import Banner from 'components/Banner';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const PasswordResetPage = ({ loginCallback, code }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Reset Password</h5>
      </CardHeader>
      <CardBody>
        <CSRFForm method="POST" action={`/user/lostpasswordreset/${code}`}>
          <FormGroup>
            <Row>
              <Col sm="4">
                <Label>Email Address:</Label>
              </Col>
              <Col sm="8">
                <Input maxLength="1000" name="email" id="email" type="text" />
              </Col>
            </Row>
          </FormGroup>
          <FormGroup>
            <Row>
              <Col sm="4">
                <Label>New Password:</Label>
              </Col>
              <Col sm="8">
                <Input maxLength="1000" name="password" id="password" type="password" />
              </Col>
            </Row>
          </FormGroup>
          <FormGroup>
            <Row>
              <Col sm="4">
                <Label>Confirm New Password:</Label>
              </Col>
              <Col sm="8">
                <Input maxLength="1000" name="password2" id="confirmPassword" type="password" />
              </Col>
            </Row>
          </FormGroup>
          <Button type="submit" color="accent" block outline>
            Change Password
          </Button>
        </CSRFForm>
      </CardBody>
    </Card>
  </MainLayout>
);

PasswordResetPage.propTypes = {
  loginCallback: PropTypes.string,
  code: PropTypes.string.isRequired,
};

PasswordResetPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(PasswordResetPage);
