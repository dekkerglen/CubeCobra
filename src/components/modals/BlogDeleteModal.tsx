import React from 'react';

import ConfirmDeleteModal from 'components/modals/ConfirmDeleteModal';
import { csrfFetch } from 'utils/CSRF';

export interface BlogDeleteModalProps {
  isOpen: boolean;
  setOpen: () => void;
  postID: string;
}

const BlogDeleteModal: React.FC<BlogDeleteModalProps> = ({ isOpen, setOpen, postID }) => {
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
