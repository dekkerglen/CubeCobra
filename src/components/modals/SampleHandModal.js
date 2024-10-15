import React, { Component } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, NavLink } from 'reactstrap';

import PropTypes from 'prop-types';

import CardGrid from 'components/card/CardGrid';
import FoilCardImage from 'components/FoilCardImage';
import { arrayShuffle } from 'utils/Util';

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
    for (const row of deck) {
      for (const col of row) {
        for (const card of col) {
          if (card) pool.push(card);
        }
      }
    }

    arrayShuffle(pool);
    const hand = pool.splice(0, Math.min(7, pool.length));

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
        <NavLink className="text-secondary" href="#" onClick={this.open}>
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
            <Button color="accent" onClick={this.refresh}>
              New Hand
            </Button>
            <Button color="accent" onClick={this.draw}>
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
  deck: PropTypes.array.isRequired,
};

export default SampleHandModal;