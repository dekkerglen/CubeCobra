import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Card, CardBody, CardHeader, CardTitle, Col, Row, CardText } from 'reactstrap';

import FoilCardImage from 'components/FoilCardImage';
import DecksPickBreakdown from 'components/DecksPickBreakdown';
import CommentEntry from 'components/CommentEntry';
import CommentsSection from 'components/CommentsSection';
import { subtitle as makeSubtitle } from 'pages/CubeDraftPage';

const DeckStacksStatic = ({ cards }) => (
  <CardBody className="pt-0 border-bottom">
    {cards.map((row, index) => (
      <Row key={/* eslint-disable-line react/no-array-index-key */ index} className="row-low-padding">
        {row.map((column, index2) => (
          <Col
            key={/* eslint-disable-line react/no-array-index-key */ index2}
            className="card-stack col-md-1-5 col-low-padding"
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

const DeckCard = ({ seat, comments, deckid, userid, deck, seatIndex, draft, view }) => {
  const [commentList, setCommentList] = useState(comments);
  const [childExpanded, setChildCollapse] = useState(false);

  const onPost = (comment) => {
    comment.index = commentList.length;
    const newList = commentList.slice();
    newList.push(comment);
    setCommentList(newList);
  };
  const saveEdit = (subComments, position, comment) => {
    if (position.length === 1) {
      subComments[position[0]] = comment;
    } else if (position.length > 1) {
      saveEdit(subComments[position[0]].comments, position.slice(1), comment);
    }
  };
  const submitEdit = async (comment, position) => {
    // update current state
    saveEdit(comments, position, comment);
  };
  const toggleChildCollapse = () => {
    setChildCollapse(!childExpanded);
  };

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
      {view === 'picks' ? (
        <CardBody>
          <DecksPickBreakdown deck={deck} seatIndex={seatIndex} draft={draft} />
        </CardBody>
      ) : (
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
      <CardBody>
        <CardText dangerouslySetInnerHTML={{ __html: seat.description }} />
      </CardBody>
      <CardBody className="px-4 pt-2 pb-0 border-top">
        <CommentEntry id={deckid} position={[]} onPost={onPost} submitUrl="/cube/api/postdeckcomment">
          <h6 className="comment-button mb-2 text-muted clickable">Add Comment</h6>
        </CommentEntry>
      </CardBody>
      {commentList.length > 0 && (
        <CardBody className=" px-4 pt-2 pb-0 border-top">
          <CommentsSection
            expanded={childExpanded}
            toggle={toggleChildCollapse}
            id={deckid}
            comments={commentList}
            position={[]}
            userid={userid}
            loggedIn
            submitEdit={submitEdit}
            focused={false}
            submitUrl="/cube/api/postdeckcomment"
          />
        </CardBody>
      )}
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
  deckid: PropTypes.string.isRequired,
  comments: PropTypes.arrayOf(PropTypes.object),
  view: PropTypes.string,
  draft: PropTypes.shape({}).isRequired,
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
  }).isRequired,
  seatIndex: PropTypes.number.isRequired,
};

DeckCard.defaultProps = {
  userid: null,
  view: 'deck',
  comments: [],
};

export default DeckCard;
