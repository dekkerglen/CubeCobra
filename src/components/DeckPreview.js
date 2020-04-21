import React, { useCallback, useRef, useState } from 'react';
import TimeAgo from 'react-timeago';
import PropTypes from 'prop-types';

import useKeyHandlers from 'hooks/UseKeyHandlers';
import DeckDeleteModal from 'components/DeckDeleteModal';

const DeckPreview = ({ deck, canEdit }) => {
  const maxLength = 35;
  const { date } = deck;
  const deleteModal = useRef();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  let { name } = deck.seats[0];

  if (!name) {
    name = 'Untitled Deck';
  }
  if (name.length > maxLength) {
    name = `${name.slice(0, maxLength - 3)}...`;
  }

  const handleClick = useKeyHandlers(
    useCallback(() => {
      window.location.href = `/cube/deck/${deck._id}`;
    }, [deck._id]),
  );

  const openDeleteModal = useKeyHandlers(
    useCallback(
      (event) => {
        event.stopPropagation();
        setDeleteModalOpen(true);
      },
      [setDeleteModalOpen],
    ),
  );

  const toggleDeleteModal = useCallback(() => {
    setDeleteModalOpen(!deleteModalOpen);
  }, [deleteModalOpen, setDeleteModalOpen]);

  return (
    <div className="deck-preview" {...handleClick}>
      {canEdit && (
        <>
          <button type="button" className="close" style={{ fontSize: '1rem' }} {...openDeleteModal}>
            x
          </button>
          <DeckDeleteModal
            toggle={toggleDeleteModal}
            isOpen={deleteModalOpen}
            deckID={deck._id}
            cubeID={deck.cube}
            ref={deleteModal}
          />
        </>
      )}
      <h6 className="mb-0 text-muted">
        <a href={`/cube/deck/${deck._id}`}>{name}</a> by{' '}
        {deck.seats[0].userid ? (
          <a href={`/user/view/${deck.seats[0].userid}`}>{deck.seats[0].username}</a>
        ) : (
          'Anonymous'
        )}{' '}
        - <TimeAgo date={date} />
      </h6>
    </div>
  );
};

DeckPreview.propTypes = {
  deck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    cube: PropTypes.string.isRequired,
    seats: PropTypes.arrayOf(PropTypes.object),
    date: PropTypes.instanceOf(Date),
  }).isRequired,
  canEdit: PropTypes.bool.isRequired,
};

export default DeckPreview;
