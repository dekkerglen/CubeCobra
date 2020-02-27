import React, { useCallback } from 'react';
import PropTypes from 'prop-types';

import AgeText from 'components/AgeText';
import useKeyHandlers from 'hooks/UseKeyHandlers';

const DeckPreview = ({ deck }) => {
  const maxLength = 35;
  const { date } = deck;

  let { name } = deck.seats[0];
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
        {deck.seats[0].userid ? (
          <a href={`/user/view/${deck.seats[0].userid}`}>{deck.seats[0].username}</a>
        ) : (
          'Anonymous'
        )}{' '}
        - <AgeText date={date} />
      </h6>
    </div>
  );
};

DeckPreview.propTypes = {
  deck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    seats: PropTypes.arrayOf(PropTypes.object),
    date: PropTypes.instanceOf(Date),
  }).isRequired,
};

export default DeckPreview;
