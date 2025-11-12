import React, { useContext } from 'react';

import { CSRFContext } from '../../contexts/CSRFContext';
import ConfirmDeleteModal from './ConfirmDeleteModal';

export interface RecordDeleteModalProps {
  isOpen: boolean;
  setOpen: () => void;
  recordId: string;
}

const RecordDeleteModal: React.FC<RecordDeleteModalProps> = ({ isOpen, setOpen, recordId }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const confirm = async () => {
    const response = await csrfFetch(`/cube/records/remove/${recordId}`, {
      method: 'DELETE',
      headers: {},
    });

    if (!response.ok) {
      console.error(response);
    } else {
      window.location.href = '';
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
