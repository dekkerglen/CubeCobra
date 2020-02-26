import React, { Component } from 'react';

import { Row, Col, ListGroup, ListGroupItem, Card, CardBody } from 'reactstrap';

import withAutocard from 'components/WithAutocard';
import FoilCardImage from './FoilCardImage';

const AutocardItem = withAutocard(ListGroupItem);
import { encodeName } from 'utils/Card';
import { getCardColorClass } from 'components/TagContext';

class DecksPickBreakdown extends Component {
  constructor(props) {
    super(props);

    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.click = this.click.bind(this);
    this.setPickIndex = this.setPickIndex.bind(this);

    this.state = {
      isOpen: false,
      index: 0,
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
    const { draft, seatIndex, deck } = this.props;

    console.log(draft);

    const cardsInPack = [];

    let start = 0;
    let end = draft.initial_state[0][0].length;
    let picks = parseInt(index);
    let pack = 0;
    while (picks >= draft.initial_state[0][pack].length) {
      start = end;
      end += draft.initial_state[0][pack].length;
      picks -= draft.initial_state[0][pack].length;
      pack += 1;
    }

    console.log(`pack ${pack} pick ${picks}: ${start + picks} - ${end}`);

    let current = seatIndex;
    for (let i = start + picks; i < end; i += 1) {
      cardsInPack.push(deck.seats[current].pickorder[i]);
      if (pack % 2 == 0) {
        current += 1;
        current %= draft.initial_state.length;
      } else {
        current -= 1;
        if (current < 0) {
          current = draft.initial_state.length - 1;
        }
      }
    }

    const picksList = [];
    let added = 0;
    for (const list of draft.initial_state[0]) {
      picksList.push(seat.pickorder.slice(added, added + list.length));
      added += list.length;
    }

    console.log(picksList);
    let ind = 0;
    for (const list of picksList) {
      for (const card of list) {
        card.index = ind;
        ind += 1;
      }
    }

    return (
      <Row>
        <Col xs={12} sm={3}>
          <h4>Pick Order</h4>
          {picksList.map((list, listindex) => (
            <ListGroup key={listindex} className="list-outline">
              <ListGroupItem className="list-group-heading">{`Pack ${listindex + 1}`}</ListGroupItem>
              {list.map((card) => (
                <AutocardItem
                  key={card.listindex}
                  card={card}
                  className={`card-list-item d-flex flex-row ${getCardColorClass(card)}`}
                  data-in-modal={true}
                  onClick={this.click}
                  index={card.index}
                >
                  {card.index == index ? <strong>{card.details.name + ' 🠰'}</strong> : <>{card.details.name}</>}
                </AutocardItem>
              ))}
            </ListGroup>
          ))}
        </Col>
        <Col xs={12} sm={9}>
          <h4>{`Pack ${pack + 1}: Pick ${picks + 1}`}</h4>
          <Row noGutters>
            {cardsInPack.map((card, index) => (
              <Col xs={4} sm={2}>
                <a key={index} href={`/tool/card/${encodeName(card.details.name)}`}>
                  <FoilCardImage autocard data-in-modal={true} card={card} className="clickable" />
                </a>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    );
  }
}
export default DecksPickBreakdown;
