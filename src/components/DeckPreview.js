import React, { useCallback, useRef, useState } from 'react';
import TimeAgo from 'react-timeago';
import PropTypes from 'prop-types';

import useKeyHandlers from 'hooks/UseKeyHandlers';
import DeckDeleteModal from 'components/DeckDeleteModal';

const DeckPreview = ({ deck, canEdit, nextURL }) => {
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

  const openDeleteModal = (event) => {
    event.stopPropagation();
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
  };

  return (
    <div className="deck-preview" {...handleClick}>
      {canEdit && (
        <>
          <button
            type="button"
            className="close"
            style={{
              fontSize: '.8rem',
              textAlign: 'center',
              width: '19px',
              height: '19px',
              paddingBottom: '2px',
              lineHeight: '17px',
              border: '1px solid rgba(0,0,0,.5)',
            }}
            onClick={openDeleteModal}
          >
            X
            <DeckDeleteModal
              toggle={closeDeleteModal}
              isOpen={deleteModalOpen}
              deckID={deck._id}
              cubeID={deck.cube}
              ref={deleteModal}
              nextURL={nextURL}
            />
          </button>
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
  nextURL: PropTypes.string,
};

DeckPreview.defaultProps = {
  nextURL: null,
}

export default DeckPreview;
