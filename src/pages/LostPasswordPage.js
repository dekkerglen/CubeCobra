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
          <Button type="submit" color="success" block outline>
            Continue
          </Button>
        </CSRFForm>
      </CardBody>
    </Card>
  </MainLayout>
);

LostPassword.propTypes = {
  post: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }).isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

LostPassword.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(LostPassword);
