import PropTypes from 'prop-types';

import React from 'react';

import { csrfFetch } from 'utils/CSRF';

import ConfirmDeleteModal from 'components/ConfirmDeleteModal';

class DeckDeleteModal extends React.Component {
  constructor(props) {
    super(props);
    this.deckID = props.deckID;
    this.cubeID = props.cubeID;
    this.nextURL = props.nextURL;
    this.confirm = this.confirm.bind(this);
  }

  async confirm() {
    const response = await csrfFetch(`/cube/deck/deletedeck/${this.deckID}`, {
      method: 'DELETE',
      headers: {},
    });

    if (!response.ok) {
      console.log(response);
    } else if (this.nextURL) {
      window.location.href = this.nextURL;
    } else {
      window.location.href = `/cube/playtest/${this.cubeID}`;
    }
  }

  render() {
    const { isOpen, toggle } = this.props;
    return (
      <ConfirmDeleteModal
        toggle={toggle}
        delete={this.confirm}
        isOpen={isOpen}
        text="Are you sure you wish to delete this deck? This action cannot be undone."
      />
    );
  }
}

DeckDeleteModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  deckID: PropTypes.string.isRequired,
  cubeID: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
  nextURL: PropTypes.string,
};

DeckDeleteModal.defaultProps = {
  nextURL: null,
};

export default DeckDeleteModal;
