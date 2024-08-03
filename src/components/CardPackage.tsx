import React, { useCallback, useContext, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Col, Row, Spinner } from 'reactstrap';

import TimeAgo from 'react-timeago';

import AddGroupToCubeModal from 'components/AddGroupToCubeModal';
import TextBadge from 'components/TextBadge';
import Tooltip from 'components/Tooltip';
import Username from 'components/Username';
import withAutocard from 'components/WithAutocard';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import CardPackageData, { APPROVED } from 'datatypes/CardPackage';
import { csrfFetch } from 'utils/CSRF';

const AddGroupToCubeModalLink = withModal(Button, AddGroupToCubeModal);
const AutocardA = withAutocard('a');

export interface CardPackageProps {
  cardPackage: CardPackageData;
}

const CardPackage: React.FC<CardPackageProps> = ({ cardPackage }) => {
  const user = useContext(UserContext);
  const [voters, setVoters] = useState<string[]>(cardPackage.voters);
  const [loading, setLoading] = useState(false);

  const voted = user ? voters.includes(user?.id) : false;

  const toggleVote = useCallback(async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    const response = await csrfFetch(`/packages/${voted ? 'downvote' : 'upvote'}/${cardPackage.id}`);
    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setVoters(json.voters);
      }
    }
    setLoading(false);
  }, [cardPackage.id, loading, voted]);

  const approve = async () => csrfFetch(`/packages/approve/${cardPackage.id}`);

  const unapprove = async () => csrfFetch(`/packages/unapprove/${cardPackage.id}`);

  const remove = async () => csrfFetch(`/packages/remove/${cardPackage.id}`);

  return (
    <Card className="mb-4 px-0">
      <CardHeader className="pt-2 pb-0">
        <Row noGutters>
          <Col xs="12" sm="6">
            <h5 className="card-title">
              <a href={`/packages/${cardPackage.id}`}>{cardPackage.title}</a>
            </h5>
            <h6 className="card-subtitle mb-2 text-muted">
              <Username user={{ username: cardPackage.owner }} />
              {' submitted '}
              <TimeAgo date={cardPackage.date} />
            </h6>
          </Col>
          {user ? (
            <Col xs="12" sm="6" className="pb-2">
              <div className="flex-container flex-row-reverse">
                <TextBadge name="Votes" className="mx-2">
                  {loading ? (
                    <Spinner size="sm" />
                  ) : (
                    <Tooltip text={voted ? 'Click to remove your upvote' : 'Click to upvote this package'}>
                      <button
                        type="button"
                        className="cube-id-btn"
                        onKeyDown={() => {}}
                        onClick={() => {
                          toggleVote();
                        }}
                      >
                        {voted ? <b>{voters.length}</b> : voters.length}
                      </button>
                    </Tooltip>
                  )}
                </TextBadge>

                <AddGroupToCubeModalLink
                  outline
                  color="accent"
                  modalProps={{ cards: cardPackage.cards, cubes: user.cubes || [], packid: cardPackage.id }}
                >
                  Add To Cube
                </AddGroupToCubeModalLink>
                {user && user.roles && user.roles.includes('Admin') && (
                  <>
                    {cardPackage.status === APPROVED ? (
                      <Button outline color="unsafe" className="mx-2" onClick={unapprove}>
                        Remove Approval
                      </Button>
                    ) : (
                      <Button outline color="accent" className="mx-2" onClick={approve}>
                        Approve
                      </Button>
                    )}
                    <Button outline color="unsafe" onClick={remove}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </Col>
          ) : (
            <Col xs="6">
              <div className="float-end">
                <TextBadge name="Votes" className="me-2">
                  <Tooltip text="Login to upvote">{voters.length}</Tooltip>
                </TextBadge>
              </div>
            </Col>
          )}
        </Row>
      </CardHeader>
      <CardBody>
        <Row>
          {cardPackage.cards.map((card) => (
            <Col key={`${cardPackage.id}-${card.scryfall_id}`} className="col-6 col-md-2-4 col-lg-2-4 col-xl-2-4">
              <Card className="mb-3">
                <AutocardA href={`/tool/card/${card.scryfall_id}`} image={card.image_normal} target="_blank">
                  <img className="w-100" src={card.image_normal} alt={card.name} />
                </AutocardA>
              </Card>
            </Col>
          ))}
        </Row>
      </CardBody>
    </Card>
  );
};

export default CardPackage;
