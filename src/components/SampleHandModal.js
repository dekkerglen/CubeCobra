import React, { Component } from 'react';

import FoilCardImage from 'components/FoilCardImage';
import CardGrid from 'components/CardGrid';
import PropTypes from 'prop-types';
import { arrayShuffle } from 'utils/Util';

import { Modal, ModalBody, ModalFooter, ModalHeader, Button, NavLink } from 'reactstrap';

class SampleHandModal extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      hand: [],
      pool: [],
    };

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.refresh = this.refresh.bind(this);
    this.draw = this.draw.bind(this);
  }

  refresh() {
    const { deck } = this.props;

    const pool = [];
    for (const col of deck) {
      for (const card of col) {
        pool.push(card);
      }
    }
    arrayShuffle(pool);
    const hand = pool.splice(0, 7);

    this.setState({
      hand,
      pool,
    });
  }

  draw() {
    const { hand, pool } = this.state;
    const newPool = [...pool];
    if (newPool.length > 0) {
      hand.push(newPool.splice(0, 1)[0]);

      this.setState({
        hand,
        pool: newPool,
      });
    }
  }

  open(event) {
    event.preventDefault();
    this.refresh();
    this.setState({
      isOpen: true,
    });
  }

  close() {
    this.setState({
      isOpen: false,
    });
  }

  render() {
    const { isOpen, hand } = this.state;

    return (
      <>
        <NavLink className="nav-link" href="#" onClick={this.open}>
          Sample Hand
        </NavLink>

        <Modal size="xl" isOpen={isOpen} toggle={this.close} centered>
          <ModalHeader toggle={this.close}>Sample Hand</ModalHeader>
          <ModalBody className="p-4">
            <CardGrid
              cardList={hand}
              Tag={FoilCardImage}
              colProps={{ xs: 4, className: 'col-seventh' }}
              cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
              linkDetails
            />
          </ModalBody>
          <ModalFooter>
            <Button color="success" onClick={this.refresh}>
              New Hand
            </Button>
            <Button color="success" onClick={this.draw}>
              Draw One Card
            </Button>
            <Button color="secondary" onClick={this.close}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      </>
    );
  }
}

SampleHandModal.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  deck: PropTypes.array.isRequired,
};

export default SampleHandModal;
