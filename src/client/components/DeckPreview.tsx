import React, { useContext, useMemo } from 'react';

import { XIcon } from '@primer/octicons-react';
import TimeAgo from 'react-timeago';

import Draft from '../../datatypes/Draft';
import User from '../../datatypes/User';
import UserContext from '../contexts/UserContext';
import Button from './base/Button';
import { Flexbox } from './base/Layout';
import Link from './base/Link';
import Text from './base/Text';
import DeckDeleteModal from './modals/DeckDeleteModal';
import withModal from './WithModal';

const DeleteModalButton = withModal(Button, DeckDeleteModal);

interface DeckPreviewProps {
  deck: Draft;
  nextURL?: string;
}

const DeckPreview: React.FC<DeckPreviewProps> = ({ deck, nextURL }) => {
  const user = useContext(UserContext);
  const canEdit = useMemo(() => {
    if (!user) {
      return false;
    }

    if (typeof deck.cubeOwner === 'object') {
      return user.id === deck.cubeOwner.id;
    }
    return user.id === deck.id || user.id === deck.cubeOwner;
  }, [user, deck]);

  const { date } = deck;

  // if owner is an object it's a user, otherwise it's a string
  const owner = typeof deck.owner === 'object' ? (deck.owner as User).username : deck.owner;
  const ownerId = typeof deck.owner === 'object' ? (deck.owner as User).id : deck.owner;

  return (
    <div
      className="block py-1 px-2 hover:bg-bg-active hover:cursor-pointer"
      onClick={() => {
        window.location.href = `/cube/deck/${deck.id}`;
      }}
    >
      <Flexbox direction="row" className="my-1" justify="between">
        <Flexbox direction="col">
          <Text sm semibold className="truncate flex-grow">
            {deck.name}
          </Text>
          <Text sm className="truncate flex-grow text-text-secondary">
            {'Drafted by '}
            <Link href={`/user/view/${ownerId}`}>{owner}</Link> <TimeAgo date={date} />
          </Text>
        </Flexbox>
        {canEdit && (
          <DeleteModalButton
            color="secondary"
            outline
            modalprops={{ deck, cubeID: deck.cube, nextURL }}
            stopProgagation={true}
          >
            <XIcon size={16} className="mx-1" />
          </DeleteModalButton>
        )}
      </Flexbox>
    </div>
  );
};

export default DeckPreview;
