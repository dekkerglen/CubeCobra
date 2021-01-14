import PropTypes from 'prop-types';
import DraftSeatPropType from 'proptypes/DraftSeatPropType';
import DeckPropType from 'proptypes/DeckPropType';

import { Card, CardBody, CardHeader, CardTitle, Col, Row } from 'reactstrap';

import FoilCardImage from 'components/FoilCardImage';
import DecksPickBreakdown from 'components/DecksPickBreakdown';
import DraftbotBreakdown from 'components/DraftbotBreakdown';
import CommentsSection from 'components/CommentsSection';
import Markdown from 'components/Markdown';
import { makeSubtitle } from 'utils/Card';

const DeckStacksStatic = ({ cards }) => (
  <CardBody className="pt-0 border-bottom">
    {cards.map((row, index) => (
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
              {column.map((card, index3) => (
                <div className="stacked" key={/* eslint-disable-line react/no-array-index-key */ index3}>
                  <a href={card.cardID ? `/tool/card/${card.cardID}` : null}>
                    <FoilCardImage card={card} tags={[]} autocard />
                  </a>
                </div>
              ))}
            </div>
          </Col>
        ))}
      </Row>
    ))}
  </CardBody>
);

DeckStacksStatic.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object))).isRequired,
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
              <DeckStacksStatic cards={stackedDeck} title="Deck" subtitle={makeSubtitle(seat.deck.flat().flat())} />
            </Col>
          </Row>
          {stackedSideboard && stackedSideboard.length > 0 && (
            <Row>
              <Col>
                <CardBody className="border-bottom">
                  <h4>Sideboard</h4>
                </CardBody>
                <DeckStacksStatic cards={stackedSideboard} title="Sideboard" />
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
        <Markdown markdown={seat.description} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="deck" parent={deck._id} userid={userid} collapse={false} />
      </div>
    </Card>
  );
};

DeckCard.propTypes = {
  seat: DraftSeatPropType.isRequired,
  userid: PropTypes.string,
  view: PropTypes.string,
  draft: PropTypes.shape({}).isRequired,
  deck: DeckPropType.isRequired,
  seatIndex: PropTypes.string.isRequired,
};

DeckCard.defaultProps = {
  userid: null,
  view: 'deck',
};

export default DeckCard;
