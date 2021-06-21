import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import { Card, CardHeader, CardBody } from 'reactstrap';

import Notification from 'components/Notification';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const Notifications = ({ notifications, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <Card className="mx-auto">
      <CardHeader>
        <h5>Notifications</h5>
      </CardHeader>
      <CardBody className="p-0">
        {notifications.length > 0 ? (
          notifications
            .slice()
            .reverse()
            .map((notification) => <Notification key={notification._id} notification={notification} />)
        ) : (
          <p className="m-2">
            You don't have any notifications! Why don't you try sharing your cube on the{' '}
            <a href="https://discord.gg/Hn39bCU">Cube Cobra Discord?</a>
          </p>
        )}
      </CardBody>
    </Card>
  </MainLayout>
);

Notifications.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
  loginCallback: PropTypes.string,
};

Notifications.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(Notifications);
