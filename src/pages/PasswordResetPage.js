import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import { Card, CardBody, FormGroup, Label, Input, Button, Col, Row, CardHeader } from 'reactstrap';

import CSRFForm from 'components/CSRFForm';
import Advertisement from 'components/Advertisement';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const LostPassword = ({ user, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Advertisement />
    <DynamicFlash />
    <Card className="my-3">
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
                <Input maxLength="1000" name="email" id="email" type="text" />
              </Col>
            </Row>
          </FormGroup>
          <FormGroup>
            <Row>
              <Col sm="4">
                <Label>Recovery Code:</Label>
              </Col>
              <Col sm="8">
                <Input maxLength="1000" name="code" id="code" type="text" />
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
          <Button type="submit" color="success" block outline>
            Change Password
          </Button>
        </CSRFForm>
      </CardBody>
    </Card>
  </MainLayout>
);

LostPassword.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
};

LostPassword.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(LostPassword);
