import React, { useContext } from 'react';

import ConfirmDeleteModal from 'components/modals/ConfirmDeleteModal';
import { CSRFContext } from 'contexts/CSRFContext';
import Draft from '@utils/datatypes/Draft';
import User from '@utils/datatypes/User';

interface DeckDeleteModalProps {
  deck: Draft;
  cubeID: string;
  nextURL?: string;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const DeckDeleteModal: React.FC<DeckDeleteModalProps> = ({ deck, cubeID, nextURL, isOpen, setOpen }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const confirm = async () => {
    const response = await csrfFetch(`/cube/deck/deletedeck/${deck.id}`, {
      method: 'DELETE',
      headers: {},
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console -- Debugging
      console.error(response);
    } else if (nextURL) {
      window.location.href = nextURL;
    } else {
      window.location.href = `/cube/playtest/${cubeID}`;
    }
  };

  // if owner is an object it's a user, otherwise it's a string
  const owner = typeof deck.owner === 'object' ? (deck.owner as User).username : deck.owner;

  return (
    <ConfirmDeleteModal
      setOpen={setOpen}
      submitDelete={confirm}
      isOpen={isOpen}
      text={`Are you sure you wish to delete ${deck.name} by ${owner}? This action cannot be undone.`}
    />
  );
};

export default DeckDeleteModal;
