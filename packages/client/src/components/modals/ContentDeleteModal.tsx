import React, { useContext } from 'react';

import ConfirmDeleteModal from 'components/modals/ConfirmDeleteModal';
import { CSRFContext } from 'contexts/CSRFContext';
import { Content } from '@utils/datatypes/Content';

interface ContentDeleteModalProps {
  content: Content;
  onDelete: (id: string) => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const ContentDeleteModal: React.FC<ContentDeleteModalProps> = ({ content, onDelete, isOpen, setOpen }) => {
  const { csrfFetch } = useContext(CSRFContext);

  const confirm = async () => {
    const response = await csrfFetch(`/content/delete/${content.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const json = await response.json();
      alert(json.message || 'Failed to delete content');
      // eslint-disable-next-line no-console -- Debugging
      console.error(response);
    } else {
      onDelete(content.id);
      setOpen(false);
    }
  };

  return (
    <ConfirmDeleteModal
      setOpen={setOpen}
      submitDelete={confirm}
      isOpen={isOpen}
      text={`Are you sure you want to delete "${content.title}"? This action cannot be undone.`}
    />
  );
};

export default ContentDeleteModal;
