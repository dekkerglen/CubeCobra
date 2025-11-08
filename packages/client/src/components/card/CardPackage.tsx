import React, { useCallback, useContext, useState } from 'react';

import { StarFillIcon } from '@primer/octicons-react';
import TimeAgo from 'react-timeago';

import { cardId, detailsToCard } from '@utils/cardutil';

import CardPackageData, { CardPackageStatus } from '@utils/datatypes/CardPackage';
import { UserRoles } from '@utils/datatypes/User';
import { CSRFContext } from '../../contexts/CSRFContext';
import UserContext from '../../contexts/UserContext';
import Button from '../base/Button';
import { Card, CardBody, CardHeader } from '../base/Card';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import Voter from '../base/Voter';
import AddGroupToCubeModal from '../modals/AddGroupToCubeModal';
import Username from '../Username';
import withModal from '../WithModal';
import CardGrid from './CardGrid';

const AddGroupToCubeModalLink = withModal(Button, AddGroupToCubeModal);

export interface CardPackageProps {
  cardPackage: CardPackageData;
}

const CardPackage: React.FC<CardPackageProps> = ({ cardPackage }) => {
  const { csrfFetch } = useContext(CSRFContext);
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
  }, [cardPackage.id, csrfFetch, loading, voted]);

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
                modalprops={{ cards: cardPackage.cards, cubes: user.cubes || [], packid: cardPackage.id }}
              >
                Add To Cube
              </AddGroupToCubeModalLink>
              {user && user.roles && user.roles.includes(UserRoles.ADMIN) && (
                <>
                  {cardPackage.status === CardPackageStatus.APPROVED ? (
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
