import PropTypes from 'prop-types';

import React from 'react';

import { Modal, ModalBody, ModalFooter, ModalHeader, Button } from 'reactstrap';

class ConfirmDeleteModal extends React.Component {
  constructor(props) {
    super(props);
    this.toggle = props.toggle;
    this.delete = props.delete;
    this.text = props.text;
    this.acceptButton = React.createRef();
    this.focusAcceptButton = this.focusAcceptButton.bind(this);
  }

  focusAcceptButton() {
    if (this.acceptButton.current) {
      this.acceptButton.current.focus();
    }
  }

  render() {
    const { isOpen } = this.props;
    return (
      <Modal isOpen={isOpen} toggle={this.toggle} onOpened={this.focusAcceptButton}>
        <ModalHeader toggle={this.toggle}>Confirm Delete</ModalHeader>
        <ModalBody>
          <p>{this.text}</p>
        </ModalBody>
        <ModalFooter>
          <Button innerRef={this.acceptButton} color="danger" onClick={this.delete}>
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

ConfirmDeleteModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  delete: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  text: PropTypes.string.isRequired,
};

export default ConfirmDeleteModal;
