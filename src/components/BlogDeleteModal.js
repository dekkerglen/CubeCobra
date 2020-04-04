import PropTypes from 'prop-types';

import React from 'react';

import { Modal, ModalBody, ModalFooter, ModalHeader, Button } from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';

class BlogDeleteModal extends React.Component {
  constructor(props) {
    super(props);
    this.toggle = props.toggle;
    this.acceptButton = React.createRef();
    this.confirm = this.confirm.bind(this);
    this.focusAcceptButton = this.focusAcceptButton.bind(this);
  }

  focusAcceptButton() {
    if (this.acceptButton.current) {
      this.acceptButton.current.focus();
    }
  }

  confirm() {
    const { postID } = this.props;
    csrfFetch(`/cube/blog/remove/${postID}`, {
      method: 'DELETE',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.log(response);
      } else {
        window.location.href = '';
      }
    });
  }

  render() {
    const { isOpen } = this.props;
    return (
      <Modal isOpen={isOpen} toggle={this.toggle} onOpened={this.focusAcceptButton}>
        <ModalHeader toggle={this.toggle}>Confirm Delete</ModalHeader>
        <ModalBody>
          <p>Are you sure you wish to delete this post? This action cannot be undone.</p>
        </ModalBody>
        <ModalFooter>
          <Button innerRef={this.acceptButton} color="danger" onClick={this.confirm}>
            Delete
          </Button>{' '}
          <Button color="secondary" onClick={this.toggle}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

BlogDeleteModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  postID: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
};

export default BlogDeleteModal;
