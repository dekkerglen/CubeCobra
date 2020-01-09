import React from 'react';

import AgeText from './AgeText';

class DeckPreview extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const maxLength = 35;

    const deck = this.props.deck;
    if (deck.name.length > maxLength) {
      deck.name = deck.name.slice(0, maxLength - 3) + '...';
    }
    return (
      <a className="no-underline-hover" href={'/cube/deck/' + deck._id}>
        <div className="border-top pb-2 pt-3 px-2 deck-preview">
          <h6 className="card-subtitle mb-2 text-muted">
            <a href={'/cube/deck/' + deck._id}>{deck.name}</a>
            {' by '}
            {deck.owner ? <a href={'/user/view/' + deck.owner}>{deck.username}</a> : <a>Anonymous</a>} {' - '}
            <AgeText date={deck.date} />
          </h6>
        </div>
      </a>
    );
  }
}

export default DeckPreview;
