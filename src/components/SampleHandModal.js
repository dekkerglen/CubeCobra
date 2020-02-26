import React, { Component } from 'react';

import FoilCardImage from 'components/FoilCardImage';
import { encodeName } from 'utils/Card';
import { arrayShuffle } from 'utils/Util';

import { Modal, ModalBody, ModalFooter, ModalHeader, Button, Col, Row } from 'reactstrap';

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
    const pool = [];
    for (const col of this.props.deck) {
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
    let { hand, pool } = this.state;
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
    const { isOpen, hand, pool } = this.state;

    return (
      <>
        <a className="nav-link" href="#" onClick={this.open}>
          Sample Hand
        </a>

        <Modal size="lg" isOpen={isOpen} toggle={this.close}>
          <ModalHeader toggle={this.close}>Sample Hand</ModalHeader>
          <ModalBody>
            <Row noGutters>
              {hand.map((card, cardindex) => (
                <Col key={/* eslint-disable-line react/no-array-index-key */ cardindex} xs={4} sm={2}>
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

export default SampleHandModal;
