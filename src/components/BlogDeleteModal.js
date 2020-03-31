import React from 'react';

import { Modal, ModalBody, ModalFooter, ModalHeader, Button, } from 'reactstrap';

class BlogDeleteModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: Boolean(props.isOpen),
    }
    
    this.close = this.close.bind(this);
    this.confirm = this.confirm.bind(this);
    this.keyPress = this.keyPress.bind(this);

    if (this.state.isOpen) {
      document.addEventListener("keyup", this.keyPress);
    }
  }

  close() {
    document.removeEventListener("keyup", this.keyPress);
    this.setState({
      isOpen: false,
    });
  }

  keyPress(event) {
    if (event.keyCode === 13) {
      this.confirm();
    }
  }

  confirm() {
    csrfFetch(`/cube/blog/remove/${this.props.postID}`, {
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
    const {isOpen} = this.state;
    return (
      <>
        <Modal isOpen={isOpen} toggle={this.close}>
          <ModalHeader toggle={this.close}>Confirm Delete</ModalHeader>
          <ModalBody>
            <p>Are you sure you wish to delete this post? This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" onClick={this.confirm}>
              Delete
            </Button>{' '}
            <Button color="secondary" onClick={this.close}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      </>
    )
  }
}

export default BlogDeleteModal;
