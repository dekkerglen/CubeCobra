import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, CardTitle, Col, Row, CardText } from 'reactstrap';

import FoilCardImage from 'components/FoilCardImage';
import DecksPickBreakdown from 'components/DecksPickBreakdown';
import DraftbotBreakdown from 'components/DraftbotBreakdown';
import CommentsSection from 'components/CommentsSection';
import { subtitle as makeSubtitle } from 'pages/CubeDraftPage';

const DeckStacksStatic = ({ piles, cards }) => (
  <CardBody className="pt-0 border-bottom">
    {piles.map((row, index) => (
      <Row key={/* eslint-disable-line react/no-array-index-key */ index} className="row-low-padding">
        {row.map((column, index2) => (
          <Col
            key={/* eslint-disable-line react/no-array-index-key */ index2}
            className="card-stack col-md-1-5 col-lg-1-5 col-xl-1-5 col-low-padding"
            xs={3}
          >
            <div className="w-100 text-center mb-1">
              <b>{column.length > 0 ? column.length : ''}</b>
            </div>
            <div className="stack">
              {column.map((cardIndex, index3) => {
                const card = cards[cardIndex];
                return (
                  <div className="stacked" key={/* eslint-disable-line react/no-array-index-key */ index3}>
                    <a href={card.cardID ? `/tool/card/${card.cardID}` : null}>
                      <FoilCardImage card={card} tags={[]} autocard />
                    </a>
                  </div>
                );
              })}
            </div>
          </Col>
        ))}
      </Row>
    ))}
  </CardBody>
);

DeckStacksStatic.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })).isRequired,
  piles: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number.isRequired))).isRequired,
};

const DeckCard = ({ seat, userid, deck, seatIndex, draft, view }) => {
  const stackedDeck = [seat.deck.slice(0, 8), seat.deck.slice(8, 16)];
  const stackedSideboard = [seat.sideboard.slice(0, 16)];
  let sbCount = 0;
  for (const col of stackedSideboard[0]) {
    sbCount += col.length;
  }
  if (sbCount <= 0) {
    stackedSideboard.splice(0, stackedSideboard.length);
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

  let lastFullSB;
  for (const row of stackedSideboard) {
    for (lastFullSB = row.length - 1; lastFullSB >= 0; lastFullSB--) {
      if (row[lastFullSB] && row[lastFullSB].length > 0) {
        break;
      }
    }
    const startCut = lastFullSB + 1;
    row.splice(startCut, row.length - startCut);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="mb-0 d-flex flex-row align-items-end">
          <h4 className="mb-0 mr-auto">{seat.name}</h4>
          {!seat.bot && (
            <h6 className="mb-0 font-weight-normal d-none d-sm-block">
              Drafted by {seat.userid ? <a href={`/user/view/${seat.userid}`}>{seat.username}</a> : 'Anonymous'}
            </h6>
          )}
        </CardTitle>
      </CardHeader>
      {view === 'picks' && (
        <CardBody>
          {draft ? (
            <DecksPickBreakdown deck={deck} seatIndex={seatIndex} draft={draft} />
          ) : (
            <h4>This deck does not have a related draft log.</h4>
          )}
        </CardBody>
      )}
      {view === 'deck' && (
        <>
          <Row className="mt-3">
            <Col>
              <DeckStacksStatic
                piles={stackedDeck}
                cards={deck.cards}
                title="Deck"
                subtitle={makeSubtitle(
                  seat.deck
                    .flat()
                    .flat()
                    .map((cardIndex) => deck.cards[cardIndex]),
                )}
              />
            </Col>
          </Row>
          {stackedSideboard && stackedSideboard.length > 0 && (
            <Row>
              <Col>
                <CardBody className="border-bottom">
                  <h4>Sideboard</h4>
                </CardBody>
                <DeckStacksStatic piles={stackedSideboard} cards={deck.cards} title="Sideboard" />
              </Col>
            </Row>
          )}
        </>
      )}
      {view === 'draftbot' && (
        <CardBody>
          {draft ? (
            <DraftbotBreakdown deck={deck} seatIndex={seatIndex} draft={draft} />
          ) : (
            <h4>This deck does not have a related draft log.</h4>
          )}
        </CardBody>
      )}
      <CardBody>
        <CardText dangerouslySetInnerHTML={{ __html: seat.description }} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="deck" parent={deck._id} userid={userid} />
      </div>
    </Card>
  );
};

DeckCard.propTypes = {
  seat: PropTypes.shape({
    description: PropTypes.string.isRequired,
    deck: PropTypes.array.isRequired,
    sideboard: PropTypes.array.isRequired,
    username: PropTypes.string.isRequired,
    userid: PropTypes.string,
    bot: PropTypes.array,
    name: PropTypes.string.isRequired,
  }).isRequired,
  userid: PropTypes.string,
  view: PropTypes.string,
  draft: PropTypes.shape({ cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })).isRequired })
    .isRequired,
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
      }),
    ).isRequired,
    cube: PropTypes.string.isRequired,
    comments: PropTypes.arrayOf(PropTypes.object).isRequired,
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string })).isRequired,
  }).isRequired,
  seatIndex: PropTypes.string.isRequired,
};

DeckCard.defaultProps = {
  userid: null,
  view: 'deck',
};

export default DeckCard;
