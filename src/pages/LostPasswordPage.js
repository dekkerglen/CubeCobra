import React from 'react';
import { Button, Card, CardBody, CardHeader, Col, FormGroup, Input, Label, Row } from 'reactstrap';

import PropTypes from 'prop-types';

import Banner from 'components/Banner';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const LostPassword = ({ loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <Card className="my-3">
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
                <Input maxLength="1000" name="email" id="email" type="text" />
              </Col>
            </Row>
          </FormGroup>
          <Button type="submit" color="accent" block outline>
            Continue
          </Button>
        </CSRFForm>
      </CardBody>
    </Card>
  </MainLayout>
);

LostPassword.propTypes = {
  post: PropTypes.shape({}).isRequired,
  loginCallback: PropTypes.string,
};

LostPassword.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(LostPassword);
