import React from 'react';

import PropTypes from 'prop-types';
import TimeAgo from 'react-timeago';

const Notification = ({ notification }) => {
  const texts = notification.body.split(notification.fromUsername);
  return (
    <a className="no-underline-hover" href={`/user/notification/${notification.id}`}>
      <div className="border-top pb-2 pt-3 px-2 deck-preview">
        <h6 className="card-subtitle mb-2 text-muted">
          <a href={`/user/notification/${notification.id}`}>{texts[0]}</a>
          <a href={`/user/view/${notification.from}`}>{notification.fromUsername}</a>
          <a href={`/user/notification/${notification.id}`}>{texts[1]}</a>
          {' - '}
          <TimeAgo date={notification.date} />
        </h6>
      </div>
    </a>
  );
};

Notification.propTypes = {
  notification: PropTypes.shape({
    body: PropTypes.string,
    from: PropTypes.string,
    fromUsername: PropTypes.string,
    url: PropTypes.string,
    to: PropTypes.string,
    date: PropTypes.number,
    id: PropTypes.string,
  }).isRequired,
};

export default Notification;
