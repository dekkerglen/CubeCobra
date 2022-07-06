import React from 'react';
import PropTypes from 'prop-types';
import TimeAgo from 'react-timeago';

const Notification = ({ notification }) => {
  const texts = notification.Body.split(notification.FromUsername);
  return (
    <a className="no-underline-hover" href={`/user/notification/${notification.Id}`}>
      <div className="border-top pb-2 pt-3 px-2 deck-preview">
        <h6 className="card-subtitle mb-2 text-muted">
          <a href={`/user/notification/${notification.Id}`}>{texts[0]}</a>
          <a href={`/user/view/${notification.From}`}>{notification.FromUsername}</a>
          <a href={`/user/notification/${notification.Id}`}>{texts[1]}</a>
          {' - '}
          <TimeAgo date={notification.Date} />
        </h6>
      </div>
    </a>
  );
};

Notification.propTypes = {
  notification: PropTypes.shape({
    Body: PropTypes.string,
    From: PropTypes.string,
    FromUsername: PropTypes.string,
    Url: PropTypes.string,
    To: PropTypes.string,
    Date: PropTypes.number,
    Id: PropTypes.string,
  }).isRequired,
};

export default Notification;
