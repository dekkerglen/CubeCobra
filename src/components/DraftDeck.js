import React, { Fragment, useCallback, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Col,
  Collapse,
  ListGroup,
  ListGroupItem,
  Nav,
  Navbar,
  NavbarToggler,
  NavItem,
  NavLink,
  Row,
  CardText,
} from 'reactstrap';

import { sortDeck } from '../util/Util';

import CustomImageToggler from './CustomImageToggler';
import { DisplayContextProvider } from './DisplayContext';
import { subtitle } from './DraftView';
import DynamicFlash from './DynamicFlash';
import FoilCardImage from './FoilCardImage';
import { getCardColorClass } from './TagContext';
import withAutocard from './WithAutocard';
import CommentEntry from './CommentEntry';
import CommentsSection from './CommentsSection';

const AutocardItem = withAutocard(ListGroupItem);

const DeckStacksStatic = ({ title, subtitle, cards, ...props }) => (
  <Card {...props}>
    <CardHeader>
      <CardTitle className="mb-0 d-flex flex-row align-items-end">
        <h4 className="mb-0 mr-auto">{title}</h4>
        <h6 className="mb-0 font-weight-normal d-none d-sm-block">{subtitle}</h6>
      </CardTitle>
    </CardHeader>
    <CardBody className="pt-0">
      {cards.map((row, index) => (
        <Row key={index} className="row-low-padding">
          {row.map((column, index2) => (
            <Col key={index2} className="mt-3 card-stack col-md-1-5 col-low-padding" xs={3}>
              <div className="w-100 text-center mb-1">
                <b>{column.length > 0 ? column.length : ''}</b>
              </div>
              <div className="stack">
                {column.map((card, index3) => (
                  <div className="stacked" key={index3}>
                    <a href={card.cardID ? '/tool/card/' + card.cardID : null}>
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
  </Card>
);

DeckStacksStatic.propTypes = {
  title: PropTypes.node.isRequired,
  cards: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object))).isRequired,
};

const DraftDeck = ({ oldFormat, drafter, cards, deck, sideboard, botDecks, bots, canEdit, description, name, comments, deckid, userid }) => {

  const [commentList, setCommentList] = useState(comments);
  const [childExpanded, setChildCollapse] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const toggleNavbar = useCallback(
    (event) => {
      event.preventDefault();
      setIsOpen(!isOpen);
    },
    [isOpen],
  );

  const onPost = function(comment) {
    comment.index = commentList.length;
    const newList = commentList.slice();
    newList.push(comment);
    setCommentList(newList);
  }
  const saveEdit = function(comments, position, comment) {
    if (position.length == 1) {
      comments[position[0]] = comment;
    } else if (position.length > 1) {
      saveEdit(comments[position[0]].comments, position.slice(1), comment);
    }
  }
  const submitEdit = async function(comment, position) {
    //update current state
    saveEdit(this.props.post.comments, position, comment);
  }
  const toggleChildCollapse = function() {
    setChildCollapse(!childExpanded);
  }

  let stackedDeck;
  let stackedSideboard;
  if (oldFormat) {
    stackedDeck = sortDeck(cards);
    stackedSideboard = [];
  } else {
    stackedDeck = [deck.slice(0, 8), deck.slice(8, 16)];    
    stackedSideboard = [sideboard.slice(0, 16)]; 
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

  const components = location.pathname.split('/');
  const deckID = components[components.length - 1];

  return (
    <DisplayContextProvider>
      <div className="usercontrols">
        <Navbar expand="md" light>
          <NavbarToggler onClick={toggleNavbar} className="ml-auto" />
          <Collapse isOpen={isOpen} navbar>
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
              <NavItem className="mr-auto">
                <NavLink href={`/cube/rebuild/${deckID}`}>Clone and Rebuild</NavLink>
              </NavItem>
              <CustomImageToggler />
            </Nav>
          </Collapse>
        </Navbar>
      </div>
      <DynamicFlash />      
      <Row className="mt-3">
        <Col>
          <Card>
            <CardHeader>
              <CardTitle className="mb-0 d-flex flex-row align-items-end">
                <h4 className="mb-0 mr-auto">{name}</h4>
                <h6 className="mb-0 font-weight-normal d-none d-sm-block">
                  Drafted by {drafter.profileUrl ? <a href={drafter.profileUrl}>{drafter.name}</a> : drafter.name}
                </h6>
              </CardTitle>             
            </CardHeader>
            <CardBody>
              <CardText dangerouslySetInnerHTML={{ __html:description }} />
            </CardBody>
            <CardBody className="px-4 pt-2 pb-0 border-top">
              <CommentEntry id={deckid} position={[]} onPost={onPost} submitUrl={`/cube/api/postdeckcomment`}>
                <h6 className="comment-button mb-2 text-muted clickable">Add Comment</h6>
              </CommentEntry>
            </CardBody>
            {comments.length > 0 && (
              <CardBody className=" px-4 pt-2 pb-0 border-top">
                <CommentsSection
                  expanded={childExpanded}
                  toggle={toggleChildCollapse}
                  id={deckid}
                  comments={commentList}
                  position={[]}
                  userid={userid}
                  loggedIn={true}
                  submitEdit={submitEdit}
                  focused={false}
                  submitUrl={`/cube/api/postdeckcomment`}
                />
              </CardBody>
            )}
          </Card>
        </Col>
      </Row>
      <Row className="mt-3">
        <Col>
          <DeckStacksStatic cards={stackedDeck} title={"Deck"} subtitle={subtitle(deck.flat().flat())} />
        </Col>
      </Row>
      {(stackedSideboard && stackedSideboard.length > 0) &&
        <Row className="mt-3">
          <Col>
            <DeckStacksStatic cards={stackedSideboard} title={"Sideboard"} />
          </Col>
        </Row>
      }
      <h4 className="mt-3">Bot Decks</h4>
      <Row className="row-low-padding">
        {botDecks.map((deck, botIndex) => (
          <Col key={botIndex} xs={6} sm={3} className="col-md-1-4285 col-low-padding">
            <ListGroup className="list-outline">
              <ListGroupItem className="list-group-heading">{bots[botIndex]}</ListGroupItem>
              {deck.map((card, cardIndex) => (
                <AutocardItem
                  key={cardIndex}
                  tag="a"
                  card={{ details: card }}
                  className={`card-list-item d-flex flex-row ${getCardColorClass({ details: card })}`}
                  href={card._id ? '/tool/card/' + card._id : null}
                >
                  {card.name}
                </AutocardItem>
              ))}
            </ListGroup>
          </Col>
        ))}
      </Row>
    </DisplayContextProvider>
  );
};

DraftDeck.propTypes = {
  oldFormat: PropTypes.bool.isRequired,
  drafter: PropTypes.object.isRequired,
  cards: PropTypes.arrayOf(PropTypes.object),
  deck: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)),
  botDecks: PropTypes.arrayOf(PropTypes.array).isRequired,
  bots: PropTypes.arrayOf(PropTypes.string).isRequired,
  canEdit: PropTypes.bool.isRequired,
};

export default DraftDeck;
