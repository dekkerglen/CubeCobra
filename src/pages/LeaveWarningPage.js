import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import { Card, CardHeader, CardBody, Button } from 'reactstrap';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import ButtonLink from 'components/ButtonLink';
import RenderToRoot from 'utils/RenderToRoot';

const back = () => window.history.back();

const LeaveWarningPage = ({ user, url, loginCallback }) => (
  <MainLayout user={user} loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h4>You are about to leave CubeCobra</h4>
      </CardHeader>
      <CardBody>
        <p>
          This link leads to: <code>{url}</code>
        </p>
        <p>Are you sure you wish to proceed?</p>
        <p>
          <ButtonLink href={url} color="danger" outline>
            Yes, continue
          </ButtonLink>
          <Button className="btn" color="secondary" onClick={back}>
            Go back
          </Button>
        </p>
      </CardBody>
    </Card>
  </MainLayout>
);

LeaveWarningPage.propTypes = {
  user: UserPropType,
  url: PropTypes.string.isRequired,
  loginCallback: PropTypes.string,
};

LeaveWarningPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(LeaveWarningPage);
