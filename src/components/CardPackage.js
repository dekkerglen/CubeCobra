import React from 'react';
import PropTypes from 'prop-types';
import TimeAgo from 'react-timeago';

import CardPackagePropType from 'proptypes/CardPackagePropType';
import UserPropType from 'proptypes/UserPropType';
import withAutocard from 'components/WithAutocard';
import AddGroupToCubeModal from 'components/AddGroupToCubeModal';
import withModal from 'components/WithModal';
import TextBadge from 'components/TextBadge';
import Tooltip from 'components/Tooltip';
import CommentsSection from 'components/CommentsSection';

import { CardHeader, Card, CardBody, Row, Col, Button } from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';

const AddGroupToCubeModalLink = withModal(Button, AddGroupToCubeModal);
const AutocardA = withAutocard('a');

const CardPackage = ({ cardPackage, user, refresh }) => {
  const voted = user ? cardPackage.voters.includes(user.id) : false;

  const toggleVote = async () => {
    if (voted) {
      // downvote
      const response = await csrfFetch(`/packages/downvote/${cardPackage._id}`);
      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          refresh();
        }
      }
    } else {
      // upvote
      const response = await csrfFetch(`/packages/upvote/${cardPackage._id}`);
      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          refresh();
        }
      }
    }
  };

  const approve = async () => {
    const response = await csrfFetch(`/packages/approve/${cardPackage._id}`);
    if (response.ok) {
      const json = await response.json();
      console.log(json);
      refresh();
    }
  };

  const unapprove = async () => {
    const response = await csrfFetch(`/packages/unapprove/${cardPackage._id}`);
    if (response.ok) {
      const json = await response.json();
      console.log(json);
      refresh();
    }
  };

  const remove = async () => {
    const response = await csrfFetch(`/packages/remove/${cardPackage._id}`);
    if (response.ok) {
      const json = await response.json();
      console.log(json);
      refresh();
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pl-4 pr-0 pt-2 pb-0">
        <Row>
          <Col xs="6">
            <h5 className="card-title">{cardPackage.title}</h5>
            <h6 className="card-subtitle mb-2 text-muted">
              <a href={`/user/view/${cardPackage.userid}`}>{cardPackage.username}</a>
              {cardPackage.approved ? ' approved ' : ' submitted '}
              <TimeAgo date={cardPackage.date} />
            </h6>
          </Col>

          {user ? (
            <Col xs="6">
              <div className="flex-container flex-row-reverse">
                <TextBadge name="Votes" className="mx-2">
                  <Tooltip text={voted ? 'Click to remove your upvote' : 'Click to upvote this package'}>
                    <button
                      type="button"
                      className="cube-id-btn"
                      onKeyDown={() => {}}
                      onClick={() => {
                        toggleVote();
                      }}
                    >
                      {voted ? <b>{cardPackage.votes}</b> : cardPackage.votes}
                    </button>
                  </Tooltip>
                </TextBadge>

                <AddGroupToCubeModalLink
                  outline
                  color="success"
                  modalProps={{ cards: cardPackage.cards, cubes: user ? user.cubes : [] }}
                >
                  Add To Cube
                </AddGroupToCubeModalLink>
                {user.roles.includes('Admin') && (
                  <>
                    {cardPackage.approved ? (
                      <Button outline color="danger" className="mx-2" onClick={unapprove}>
                        Remove Approval
                      </Button>
                    ) : (
                      <Button outline color="success" className="mx-2" onClick={approve}>
                        Approve
                      </Button>
                    )}
                    <Button outline color="danger" onClick={remove}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </Col>
          ) : (
            <Col xs="6">
              <div className="float-right">
                <TextBadge name="Votes" className="mr-2">
                  <Tooltip text="Login to upvote">{cardPackage.votes}</Tooltip>
                </TextBadge>
              </div>
            </Col>
          )}
        </Row>
      </CardHeader>
      <CardBody>
        <Row>
          {cardPackage.cards.map((cardId) => (
            <Col key={cardId} xs="6" md="3" lg="2">
              <Card className="mb-3">
                <AutocardA href={`/tool/card/${cardId}`} front={`/tool/cardimage/${cardId}`} target="_blank">
                  <img className="w-100" src={`/tool/cardimage/${cardId}`} alt={cardId} />
                </AutocardA>
              </Card>
            </Col>
          ))}
        </Row>
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="package" parent={cardPackage._id} userid={user.id} collapse />
      </div>
    </Card>
  );
};

CardPackage.propTypes = {
  cardPackage: CardPackagePropType.isRequired,
  user: UserPropType,
  refresh: PropTypes.func,
};

CardPackage.defaultProps = {
  user: null,
  refresh: () => {},
};

export default CardPackage;
