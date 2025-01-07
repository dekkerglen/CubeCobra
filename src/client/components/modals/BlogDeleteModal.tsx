import React, { useContext } from 'react';

import ConfirmDeleteModal from './ConfirmDeleteModal';
import { CSRFContext } from '../../contexts/CSRFContext';

export interface BlogDeleteModalProps {
  isOpen: boolean;
  setOpen: () => void;
  postID: string;
}

const BlogDeleteModal: React.FC<BlogDeleteModalProps> = ({ isOpen, setOpen, postID }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const confirm = async () => {
    const response = await csrfFetch(`/cube/blog/remove/${postID}`, {
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
      text="Are you sure you wish to delete this post? This action cannot be undone."
    />
  );
};

export default BlogDeleteModal;
