import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

import AgeText from 'components/AgeText';
import useKeyHandlers from 'hooks/UseKeyHandlers';

const DeckPreview = ({ deck }) => {
  const maxLength = 35;
  const { date } = deck;

  let { name } = deck;
  if (name.length > maxLength) {
    name = `${name.slice(0, maxLength - 3)}...`;
  }

  const handleClick = useCallback(() => {
    window.location.href = `/cube/deck/${deck._id}`;
  }, [deck._id]);

  return (
    <div className="deck-preview" {...useKeyHandlers(handleClick)}>
      <h6 className="mb-0 text-muted">
        <a href={`/cube/deck/${deck._id}`}>{name}</a> by{' '}
        {deck.owner ? <a href={`/user/view/${deck.owner}`}>{deck.username}</a> : 'Anonymous'} -
        <AgeText date={date} />
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
    date: PropTypes.number.isRequired,
  }).isRequired,
};

export default DeckPreview;
