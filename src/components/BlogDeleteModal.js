import PropTypes from 'prop-types';

import { Component } from 'react';

import { csrfFetch } from 'utils/CSRF';

import ConfirmDeleteModal from 'components/ConfirmDeleteModal';

class BlogDeleteModal extends Component {
  constructor(props) {
    super(props);
    this.postID = props.postID;
    this.confirm = this.confirm.bind(this);
  }

  async confirm() {
    const response = await csrfFetch(`/cube/blog/remove/${this.postID}`, {
      method: 'DELETE',
      headers: {},
    });

    if (!response.ok) {
      console.log(response);
    } else {
      window.location.href = '';
    }
  }

  render() {
    const { isOpen, toggle } = this.props;
    return (
      <ConfirmDeleteModal
        toggle={toggle}
        delete={this.confirm}
        isOpen={isOpen}
        text="Are you sure you wish to delete this post? This action cannot be undone."
      />
    );
  }
}

BlogDeleteModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  postID: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
};

export default BlogDeleteModal;
