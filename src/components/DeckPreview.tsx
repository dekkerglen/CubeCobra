import React, { useContext, useState } from 'react';
import UserContext from 'contexts/UserContext';
import TimeAgo from 'react-timeago';
import DeckDeleteModal from 'components/modals/DeckDeleteModal';
import Draft from 'datatypes/Draft';
import Text from 'components/base/Text';
import { Flexbox } from 'components/base/Layout';
import User from 'datatypes/User';

interface DeckPreviewProps {
  deck: Draft;
  nextURL?: string;
}

const DeckPreview: React.FC<DeckPreviewProps> = ({ deck, nextURL }) => {
  const user = useContext(UserContext);
  const canEdit = user && (user.id === deck.id || user.id === deck.cubeOwner);

  const { date } = deck;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // if owner is an object it's a user, otherwise it's a string
  const owner = typeof deck.owner === 'object' ? (deck.owner as User).username : deck.owner;

  return (
    <a className="block py-1 px-2 hover:bg-bg-active hover:cursor-pointer" href={`/cube/deck/${deck.id}`}>
      <Flexbox direction="col">
        <Text sm semibold className="truncate flex-grow">
          {deck.name}
        </Text>
        <Flexbox direction="row" className="mb-2 text-text-secondary" justify="between">
          <Text sm className="truncate flex-grow">
            {'Drafted by '}
            {owner} <TimeAgo date={date} />
          </Text>
          {canEdit && (
            <button
              type="button"
              className="btn-close"
              style={{
                fontSize: '.8rem',
                textAlign: 'center',
                width: '19px',
                height: '19px',
                paddingBottom: '2px',
                lineHeight: '17px',
                border: '1px solid rgba(0,0,0,.5)',
                float: 'right',
              }}
              onClick={(e) => {
                e.preventDefault();
                setDeleteModalOpen(true);
              }}
            >
              <DeckDeleteModal
                setOpen={setDeleteModalOpen}
                isOpen={deleteModalOpen}
                deckID={deck.id}
                cubeID={deck.cube}
                nextURL={nextURL}
              />
            </button>
          )}
        </Flexbox>
      </Flexbox>
    </a>
  );
};

export default DeckPreview;
