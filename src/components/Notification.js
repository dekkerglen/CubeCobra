import React from 'react';
import TimeAgo from 'react-timeago';

class DeckPreview extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const notification = this.props.notification;
    const texts = notification.text.split(notification.user_from_name);
    return (
      <a className="no-underline-hover" href={notification.url}>
        <div className="border-top pb-2 pt-3 px-2 deck-preview">
          <h6 className="card-subtitle mb-2 text-muted">
            <a href={notification.url}>{texts[0]}</a>
            <a href={'/user/view/' + notification.user_from}>{notification.user_from_name}</a>
            <a href={notification.url}>{texts[1]}</a>
            {' - '}
            <TimeAgo date={notification.date} />
          </h6>
        </div>
      </a>
    );
  }
}

export default DeckPreview;
