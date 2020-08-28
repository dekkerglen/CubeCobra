import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, CardBody } from 'reactstrap';

import Notification from 'components/Notification';
import Advertisement from 'components/Advertisement';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const Notifications = ({ user, notifications }) => (
  <MainLayout user={user}>
    <Advertisement />
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
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
};

Notifications.defaultProps = {
  user: null,
};

export default RenderToRoot(Notifications);
