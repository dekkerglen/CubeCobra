import React, { useContext } from 'react';

import { CSRFContext } from '../../contexts/CSRFContext';
import ConfirmDeleteModal from './ConfirmDeleteModal';

export interface RecordDeleteModalProps {
  isOpen: boolean;
  setOpen: () => void;
  recordId: string;
  // Where to land once the record is gone. The record's own page has to be left behind — it
  // would otherwise reload itself after being deleted — while the list it was deleted from
  // just needs refreshing in place.
  redirectTo?: string;
}

const RecordDeleteModal: React.FC<RecordDeleteModalProps> = ({ isOpen, setOpen, recordId, redirectTo }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const confirm = async () => {
    const response = await csrfFetch(`/cube/records/remove/${recordId}`, {
      method: 'DELETE',
      headers: {},
    });

    if (!response.ok) {
      console.error(response);
    } else if (redirectTo) {
      window.location.assign(redirectTo);
    } else {
      window.location.reload();
    }
  };

  return (
    <ConfirmDeleteModal
      setOpen={setOpen}
      submitDelete={confirm}
      isOpen={isOpen}
      text="Are you sure you wish to delete this record? This action cannot be undone."
    />
  );
};

export default RecordDeleteModal;
