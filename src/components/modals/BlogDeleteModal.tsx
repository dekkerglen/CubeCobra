import React from 'react';

import ConfirmDeleteModal from 'components/modals/ConfirmDeleteModal';
import { csrfFetch } from 'utils/CSRF';

export interface BlogDeleteModalProps {
  isOpen: boolean;
  toggle: () => void;
  postID: string;
}

const BlogDeleteModal: React.FC<BlogDeleteModalProps> = ({ isOpen, toggle, postID }) => {
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
      toggle={toggle}
      submitDelete={confirm}
      isOpen={isOpen}
      text="Are you sure you wish to delete this post? This action cannot be undone."
    />
  );
};

export default BlogDeleteModal;
