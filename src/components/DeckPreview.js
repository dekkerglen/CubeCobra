import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

import AgeText from './AgeText';

const DeckPreview = ({ deck }) => {
  const maxLength = 35;

  let name = deck.name;
  if (name.length > maxLength) {
    name = name.slice(0, maxLength - 3) + '...';
  }

  const handleClick = useCallback(() => {
    window.location.href = `/cube/deck/${deck._id}`;
  }, [deck._id]);

  return (
    <div className="deck-preview" onClick={handleClick}>
      <h6 className="mb-0 text-muted">
        <a href={'/cube/deck/' + deck._id}>{name}</a>
        {' by '}
        {deck.owner ? <a href={'/user/view/' + deck.owner}>{deck.username}</a> : <a>Anonymous</a>} {' - '}
        <AgeText date={deck.date} />
      </h6>
    </div>
  );
};

DeckPreview.propTypes = {
  deck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    owner: PropTypes.string,
    username: PropTypes.string,
  }).isRequired,
};

export default DeckPreview;
