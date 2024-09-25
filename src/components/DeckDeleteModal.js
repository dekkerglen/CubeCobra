import React from 'react';

import PropTypes from 'prop-types';

import ConfirmDeleteModal from 'components/ConfirmDeleteModal';
import { csrfFetch } from 'utils/CSRF';

const DeckDeleteModal = ({ deckID, cubeID, nextURL, isOpen, toggle }) => {
  const confirm = async () => {
    const response = await csrfFetch(`/cube/deck/deletedeck/${deckID}`, {
      method: 'DELETE',
      headers: {},
    });

    if (!response.ok) {
      console.error(response);
    } else if (nextURL) {
      window.location.href = nextURL;
    } else {
      window.location.href = `/cube/playtest/${cubeID}`;
    }
  };

  return (
    <ConfirmDeleteModal
      toggle={toggle}
      submitDelete={confirm}
      isOpen={isOpen}
      text="Are you sure you wish to delete this deck? This action cannot be undone."
    />
  );
};

DeckDeleteModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  deckID: PropTypes.string.isRequired,
  cubeID: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
  nextURL: PropTypes.string,
};

DeckDeleteModal.defaultProps = {
  nextURL: null,
};

export default DeckDeleteModal;
