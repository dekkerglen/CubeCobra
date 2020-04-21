import PropTypes from 'prop-types';

import React from 'react';

import { Modal, ModalBody, ModalFooter, ModalHeader, Button } from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';

class DeckDeleteModal extends React.Component {
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
    const { deckID, cubeID } = this.props;
    csrfFetch(`/cube/deletedeck/${deckID}`, {
      method: 'DELETE',
      headers: {},
    }).then((response) => {
      if (!response.ok) {
        console.log(response);
      } else {
        window.location.href = `/cube/playtest/${cubeID}`;
      }
    });
  }

  render() {
    const { isOpen } = this.props;
    return (
      <Modal isOpen={isOpen} toggle={this.toggle} onOpened={this.focusAcceptButton}>
        <ModalHeader toggle={this.toggle}>Confirm Delete</ModalHeader>
        <ModalBody>
          <p>Are you sure you wish to delete this deck? This action cannot be undone.</p>
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

DeckDeleteModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  deckID: PropTypes.string.isRequired,
  cubeID: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
};

export default DeckDeleteModal;
