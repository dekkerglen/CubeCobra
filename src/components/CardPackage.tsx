import React, { useCallback, useContext, useState } from 'react';

import TimeAgo from 'react-timeago';

import AddGroupToCubeModal from 'components/AddGroupToCubeModal';
import Username from 'components/Username';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import CardPackageData, { APPROVED } from 'datatypes/CardPackage';
import { csrfFetch } from 'utils/CSRF';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CardGrid from 'components/CardGrid';
import Voter from 'components/base/Voter';
import { cardId, detailsToCard } from 'utils/Card';
import { StarFillIcon } from '@primer/octicons-react';

const AddGroupToCubeModalLink = withModal(Button, AddGroupToCubeModal);

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
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between">
          <Flexbox direction="col">
            <Text lg semibold>
              <a href={`/packages/${cardPackage.id}`}>{cardPackage.title}</a>
            </Text>
            <Text md>
              <Username user={cardPackage.owner} />
              {' submitted '}
              <TimeAgo date={cardPackage.date} />
            </Text>
          </Flexbox>
          {user ? (
            <Flexbox direction="row" gap="3" alignItems="start">
              <AddGroupToCubeModalLink
                color="primary"
                modalProps={{ cards: cardPackage.cards, cubes: user.cubes || [], packid: cardPackage.id }}
              >
                Add To Cube
              </AddGroupToCubeModalLink>
              {user && user.roles && user.roles.includes('Admin') && (
                <>
                  {cardPackage.status === APPROVED ? (
                    <Button outline color="primary" onClick={unapprove}>
                      Remove Approval
                    </Button>
                  ) : (
                    <Button outline color="primary" onClick={approve}>
                      Approve
                    </Button>
                  )}
                  <Button outline color="danger" onClick={remove}>
                    Delete
                  </Button>
                </>
              )}
              <Voter votes={voters.length} toggleVote={toggleVote} hasVoted={voted} loading={loading} />
            </Flexbox>
          ) : (
            <Flexbox direction="row" gap="2" justify="end" alignItems="center">
              <Text semibold md>
                {voters.length}
              </Text>
              <StarFillIcon size={22} className="text-yellow-500" />
            </Flexbox>
          )}
        </Flexbox>
      </CardHeader>
      <CardBody>
        <CardGrid
          cards={cardPackage.cards.map(detailsToCard)}
          xs={5}
          xxl={10}
          hrefFn={(card) => `/tool/card/${cardId(card)}`}
        />
      </CardBody>
    </Card>
  );
};

export default CardPackage;
