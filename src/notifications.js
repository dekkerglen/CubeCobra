import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import { Card, Col, Row, CardHeader, CardBody, CardFooter } from 'reactstrap';
import Notification from './components/Notification';

class Notifications extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { notifications } = this.props;
    return (
      <Card className="mx-auto" style={{ maxWidth: '40rem' }}>
        <CardHeader>
          <h5>Notifications</h5>
        </CardHeader>
        <CardBody className="p-0">
          {notifications.length > 0 ? (
            notifications
              .slice()
              .reverse()
              .map((notification) => <Notification key={notification.date} notification={notification} />)
          ) : (
            <p className="m-2">
              You don't have any notifications! Why don't you try sharing your cube on the{' '}
              <a href="https://discord.gg/Hn39bCU">Cube Cobra Discord?</a>
            </p>
          )}
        </CardBody>
      </Card>
    );
  }
}

const notifications = JSON.parse(document.getElementById('notificationData').value);
const element = <Notifications notifications={notifications} />;
const wrapper = document.getElementById('react-root');
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
