import React from 'react';
import PropTypes from 'prop-types';
import TimeAgo from 'react-timeago';

const Notification = ({ notification }) => {
  const texts = notification.text.split(notification.user_from_name);
  return (
    <a className="no-underline-hover" href={notification.url}>
      <div className="border-top pb-2 pt-3 px-2 deck-preview">
        <h6 className="card-subtitle mb-2 text-muted">
          <a href={notification.url}>{texts[0]}</a>
          <a href={`/user/view/${notification.user_from}`}>{notification.user_from_name}</a>
          <a href={notification.url}>{texts[1]}</a>
          {' - '}
          <TimeAgo date={notification.date} />
        </h6>
      </div>
    </a>
  );
};

Notification.propTypes = {
  notification: PropTypes.shape({
    text: PropTypes.string,
    user_from_name: PropTypes.string,
    url: PropTypes.string,
    user_from: PropTypes.string,
    date: PropTypes.string,
  }).isRequired,
};

export default Notification;
