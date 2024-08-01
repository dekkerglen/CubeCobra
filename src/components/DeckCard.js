import React, { useMemo } from 'react';
import { Card, CardBody, CardHeader, CardTitle, Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import DeckPropType from 'proptypes/DeckPropType';
import DeckSeatPropType from 'proptypes/DeckSeatPropType';

import CardGrid from 'components/CardGrid';
import CardImage from 'components/CardImage';
import CommentsSection from 'components/CommentsSection';
import DecksPickBreakdown from 'components/DecksPickBreakdown';
import FoilCardImage from 'components/FoilCardImage';
import Markdown from 'components/Markdown';
import Username from 'components/Username';
import { makeSubtitle } from 'utils/Card';
import { sortDeep } from 'utils/Sort';

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

const DeckCard = ({ seat, deck, seatIndex, view }) => {
  const stackedDeck = seat.mainboard.slice();
  const stackedSideboard = seat.sideboard.slice();
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

  const sorted = useMemo(() => {
    const deep = sortDeep(
      seat.mainboard.flat(3).map((cardIndex) => deck.cards[cardIndex]),
      true,
      'Unsorted',
      'Color Category',
      'Mana Value Full',
      'Unsorted',
    );
    return deep
      .map((tuple1) => tuple1[1].map((tuple2) => tuple2[1].map((tuple3) => tuple3[1].map((card) => card))))
      .flat(4);
  }, [deck.cards, seat.mainboard]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="mb-0 d-flex flex-row align-items-end">
          <h4 className="mb-0 me-auto">{seat.name}</h4>
          {!seat.bot && (
            <h6 className="mb-0 font-weight-normal d-none d-sm-block">
              Drafted by {seat.owner ? <Username user={seat.owner} /> : 'Anonymous'}
            </h6>
          )}
        </CardTitle>
      </CardHeader>
      {view === 'picks' && (
        <CardBody>
          {deck.type === 'd' ? (
            <>
              {deck.seats[0].pickorder ? (
                <DecksPickBreakdown deck={deck} seatNumber={parseInt(seatIndex, 10)} draft={deck} />
              ) : (
                <p>There is no draft log associated with this deck.</p>
              )}
            </>
          ) : (
            <p>This type of deck does not have a pick breakdown yet.</p>
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
                  seat.mainboard
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
                  <h4>sideboard</h4>
                </CardBody>
                <DeckStacksStatic piles={stackedSideboard} cards={deck.cards} title="sideboard" />
              </Col>
            </Row>
          )}
        </>
      )}
      {view === 'visual' && (
        <CardBody>
          <h4>Mainboard</h4>
          <CardGrid
            cardList={sorted}
            Tag={CardImage}
            colProps={{ className: 'col-1-2' }}
            cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
            linkDetails
          />
          {seat.sideboard.flat(2).length > 0 && (
            <>
              <hr className="my-4" />
              <h4 className="mt-4">Sideboard</h4>
              <CardGrid
                cardList={seat.sideboard.flat(2).map((cardIndex) => deck.cards[cardIndex])}
                Tag={CardImage}
                colProps={{ className: 'col-1-2' }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
            </>
          )}
        </CardBody>
      )}
      <CardBody>
        <Markdown markdown={seat.description} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="deck" parent={deck.id} collapse={false} />
      </div>
    </Card>
  );
};

DeckCard.propTypes = {
  seat: DeckSeatPropType.isRequired,
  view: PropTypes.string,
  deck: DeckPropType.isRequired,
  seatIndex: PropTypes.string.isRequired,
};

DeckCard.defaultProps = {
  view: 'deck',
};

export default DeckCard;
