import React, { Fragment } from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Col,
  Collapse,
  Input,
  ListGroup,
  ListGroupItem,
  Nav,
  Navbar,
  NavItem,
  NavLink,
  Row,
} from 'reactstrap';

import { sortDeck } from '../util/Util';

import CardImage from './CardImage';
import DeckStacks from './DeckStacks';
import DynamicFlash from './DynamicFlash';
import { getCardColorClass } from './TagContext';
import withAutocard from './WithAutocard';

const AutocardItem = withAutocard(ListGroupItem);

const DeckStacksStatic = ({ title, cards, ...props }) => (
  <Card {...props}>
    <CardHeader>
      <CardTitle className="mb-0">
        <h4 className="mb-0">{title}</h4>
      </CardTitle>
    </CardHeader>
    <CardBody className="pt-0">
      {cards.map((row, index) => (
        <Row key={index} className="draft-row">
          {row.map((column, index2) => (
            <Col key={index2} className="mt-3 card-stack col-md-1-5" xs={4} sm={3}>
              <div className="w-100 text-center mb-1">
                <b>{column.length}</b>
              </div>
              <div className="stack">
                {column.map((card, index3) => (
                  <div className="stacked" key={card.details._id}>
                    <CardImage card={card} tags={[]} />
                  </div>
                ))}
              </div>
            </Col>
          ))}
        </Row>
      ))}
    </CardBody>
  </Card>
);

const DraftDeck = ({ oldFormat, drafter, cards, deck, botDecks, bots, canEdit }) => {
  const title = (
    <Fragment>
      Drafted by {drafter.profileUrl ? <a href={drafter.profileUrl}>{drafter.name}</a> : drafter.name}
    </Fragment>
  );

  let stackedDeck;
  if (oldFormat) {
    stackedDeck = sortDeck(cards);
  } else {
    stackedDeck = [deck.slice(0, 8), deck.slice(8, 16)];
  }

  // Cut off empty columns at the end.
  let lastFull;
  for (const row of stackedDeck) {
    for (lastFull = row.length - 1; lastFull >= 0; lastFull--) {
      if (row[lastFull] && row[lastFull].length > 0) {
        break;
      }
    }
    const startCut = lastFull + 1;
    row.splice(startCut, row.length - startCut);
  }

  const components = location.pathname.split('/');
  const deckID = components[components.length - 1];

  return (
    <>
      <div className="usercontrols">
        <Navbar expand="xs" light>
          <Collapse navbar>
            <Nav navbar>
              {!canEdit ? (
                ''
              ) : (
                <NavItem>
                  <NavLink href={`/cube/deckbuilder/${deckID}`}>Edit</NavLink>
                </NavItem>
              )}
              <NavItem>
                <NavLink href={`/cube/redraft/${deckID}`}>Redraft</NavLink>
              </NavItem>
              <NavItem>
                <NavLink href={`/cube/rebuild/${deckID}`}>Clone and Rebuild</NavLink>
              </NavItem>
            </Nav>
          </Collapse>
        </Navbar>
      </div>
      <DynamicFlash />
      <Row className="mt-3">
        <Col>
          <DeckStacksStatic cards={stackedDeck} title={title} />
        </Col>
      </Row>
      <h4 className="mt-3">Bot Decks</h4>
      <Row className="row-low-padding">
        {botDecks.map((deck, botIndex) => (
          <Col key={botIndex} xs={6} sm={3} className="col-md-1-4285 col-low-padding">
            <ListGroup className="list-outline">
              <ListGroupItem className="list-group-heading">{bots[botIndex]}</ListGroupItem>
              {deck.map((card, cardIndex) => (
                <AutocardItem
                  key={cardIndex}
                  tag="div"
                  card={{ details: card }}
                  className={`card-list-item d-flex flex-row ${getCardColorClass({ details: card })}`}
                >
                  <a className="w-100">{card.name}</a>
                </AutocardItem>
              ))}
            </ListGroup>
          </Col>
        ))}
      </Row>
    </>
  );
};

export default DraftDeck;
