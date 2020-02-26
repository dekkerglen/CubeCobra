import React, { Component } from 'react';

import FoilCardImage from 'components/FoilCardImage';
import PropTypes from 'prop-types';
import { encodeName } from 'utils/Card';
import { arrayShuffle } from 'utils/Util';

import { Modal, ModalBody, ModalFooter, ModalHeader, Button, Col, Row, NavLink } from 'reactstrap';

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
    if (pool.length > 0) {
      hand.push(pool.splice(0, 1)[0]);

      this.setState({
        hand,
        pool,
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
          <ModalBody>
            <Row>
              {hand.map((card, cardindex) => (
                <Col
                  key={/* eslint-disable-line react/no-array-index-key */ cardindex}
                  className="sevenCol col-xs-4 p-1"
                >
                  <a href={`/tool/card/${encodeName(card.details.name)}`}>
                    <FoilCardImage autocard data-in-modal card={card} className="clickable" />
                  </a>
                </Col>
              ))}
            </Row>
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
  deck: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    seats: PropTypes.arrayOf(
      PropTypes.shape({
        description: PropTypes.string.isRequired,
        deck: PropTypes.array.isRequired,
        sideboard: PropTypes.array.isRequired,
        username: PropTypes.string.isRequired,
        userid: PropTypes.string,
        bot: PropTypes.array,
        name: PropTypes.string.isRequired,
        pickorder: PropTypes.array.isRequired,
      }),
    ).isRequired,
    cube: PropTypes.string.isRequired,
    comments: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
};

export default SampleHandModal;
