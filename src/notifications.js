import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import { Card, CardHeader, CardBody } from 'reactstrap';

import Notification from 'components/Notification';

const Notifications = ({ notifications }) => (
  <Card className="mx-auto" style={{ maxWidth: '40rem' }}>
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
);

Notifications.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

const notifications = JSON.parse(document.getElementById('notificationData').value);
const element = <Notifications notifications={notifications} />;
const wrapper = document.getElementById('react-root');
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
