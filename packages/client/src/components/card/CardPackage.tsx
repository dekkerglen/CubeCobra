import React, { useCallback, useContext, useState } from 'react';

import { StarFillIcon } from '@primer/octicons-react';
import { cardId, detailsToCard } from '@utils/cardutil';
import CardPackageData from '@utils/datatypes/CardPackage';
import { UserRoles } from '@utils/datatypes/User';
import TimeAgo from 'react-timeago';

import { CSRFContext } from '../../contexts/CSRFContext';
import UserContext from '../../contexts/UserContext';
import Button from '../base/Button';
import { Card, CardBody, CardHeader } from '../base/Card';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import Voter from '../base/Voter';
import AddGroupToCubeModal from '../modals/AddGroupToCubeModal';
import ConfirmActionModal from '../modals/ConfirmActionModal';
import Username from '../Username';
import withModal from '../WithModal';
import CardGrid from './CardGrid';

const AddGroupToCubeModalLink = withModal(Button, AddGroupToCubeModal);
const ConfirmDeleteButton = withModal(Button, ConfirmActionModal);

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

  const remove = useCallback(async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    const response = await csrfFetch(`/packages/remove/${cardPackage.id}`);
    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        // Redirect to packages page after successful deletion
        window.location.href = '/packages';
      } else {
        alert('Failed to delete package. Please try again.');
        setLoading(false);
      }
    } else {
      alert('Failed to delete package. Please try again.');
      setLoading(false);
    }
  }, [cardPackage.id, csrfFetch, loading]);

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
                modalprops={{ cards: cardPackage.cards, cubes: user.cubes || [], packid: cardPackage.id, voters }}
              >
                Add To Cube
              </AddGroupToCubeModalLink>
              {user && user.roles && user.roles.includes(UserRoles.ADMIN) && (
                <ConfirmDeleteButton
                  outline
                  color="danger"
                  disabled={loading}
                  modalprops={{
                    title: 'Delete Package',
                    message: `Are you sure you want to delete "${cardPackage.title}"? This action cannot be undone.`,
                    buttonText: 'Delete Package',
                    onClick: remove,
                  }}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </ConfirmDeleteButton>
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
