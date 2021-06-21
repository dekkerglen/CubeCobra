import PropTypes from 'prop-types';

import React from 'react';

import { csrfFetch } from 'utils/CSRF';

import ConfirmDeleteModal from 'components/ConfirmDeleteModal';

const BlogDeleteModal = ({ isOpen, toggle, postID }) => {
  const confirm = async () => {
    const response = await csrfFetch(`/cube/blog/remove/${postID}`, {
      method: 'DELETE',
      headers: {},
    });

    if (!response.ok) {
      console.log(response);
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

BlogDeleteModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  postID: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
};

export default BlogDeleteModal;
