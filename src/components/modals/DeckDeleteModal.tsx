import React from 'react';
import ConfirmDeleteModal from 'components/modals/ConfirmDeleteModal';
import { csrfFetch } from 'utils/CSRF';

interface DeckDeleteModalProps {
  deckID: string;
  cubeID: string;
  nextURL?: string;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const DeckDeleteModal: React.FC<DeckDeleteModalProps> = ({ deckID, cubeID, nextURL, isOpen, setOpen }) => {
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
      setOpen={setOpen}
      submitDelete={confirm}
      isOpen={isOpen}
      text="Are you sure you wish to delete this deck? This action cannot be undone."
    />
  );
};

export default DeckDeleteModal;
