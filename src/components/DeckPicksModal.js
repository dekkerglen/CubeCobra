import React, { Component } from 'react';

import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Button,
  Row,
  Col,
  ListGroup,
  ListGroupItem
} from 'reactstrap';

import withAutocard from 'components/WithAutocard';

const AutocardItem = withAutocard(ListGroupItem);
import { getCardColorClass } from 'components/TagContext';

class DeckPicksModal extends Component {
  constructor(props) {
    super(props);

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.click = this.click.bind(this);
    this.setPickIndex = this.setPickIndex.bind(this);
    
    this.state = {
      isOpen: false,
      index: 0
    };
  }

  open(event) {
    event.preventDefault();
    this.setState({
      isOpen: true,
    });
  }

  close() {
    this.setState({
      isOpen: false,
    });
  }

  click(event) {
    this.setPickIndex(event.target.getAttribute('index'));
  }

  setPickIndex(index) {
    console.log(`Setting index to ${index}`);
    this.setState({
      index: index,
    });
  }

  render() {
    const { isOpen, index } = this.state;
    const seat = this.props.deck.seats[this.props.seatIndex];
    const { draft } = this.props;

    console.log(seat);
    
    let picks = index + 1;
    let packnum = 1;
    while (picks >= draft.initial_state[0][packnum - 1].length) {
      picks -= draft.initial_state[0][packnum - 1].length;
      packnum += 1;
    }
    const picknum = picks + 1;

    return (
      <>
        <a className="nav-link" href="#" onClick={this.open}>
          Pick by Pick Breakdown
        </a>

        <Modal size="xl" isOpen={isOpen} toggle={this.close}>
          <ModalHeader toggle={this.close}>Pick by Pick Breakdown</ModalHeader>
          <ModalBody>
            <Row>
              <Col
                xs={12}
                sm={3}
              >
                <ListGroup className="list-outline">
                  <ListGroupItem className="list-group-heading">Pick Order</ListGroupItem>
                  {seat.pickorder.map((card, cardIndex) => (
                    <AutocardItem
                      key={/* eslint-disable-line react/no-array-index-key */ cardIndex}
                      card={card}
                      className={`card-list-item d-flex flex-row ${getCardColorClass(card)}`}
                      data-in-modal={true}
                      onClick={this.click}
                      index={cardIndex}
                    >
                      {cardIndex == index ? 
                      <strong>
                        {card.details.name}
                      </strong>: 
                        <>{card.details.name}</>
                      }
                    </AutocardItem>
                  ))}
                </ListGroup>
              </Col>
            </Row>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={this.close}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      </>
    );
  }
}

export default DeckPicksModal;
