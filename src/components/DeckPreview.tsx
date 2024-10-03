import React, { useContext, useState } from 'react';
import UserContext from 'contexts/UserContext';
import Username from 'components/Username';
import TimeAgo from 'react-timeago';
import DeckDeleteModal from 'components/DeckDeleteModal';
import Deck from 'datatypes/Deck';
import Text from 'components/base/Text';
import { Flexbox } from 'components/base/Layout';

interface DeckPreviewProps {
  deck: Deck;
  nextURL?: string;
}

const DeckPreview: React.FC<DeckPreviewProps> = ({ deck, nextURL }) => {
  const user = useContext(UserContext);
  const canEdit = user && (user.id === deck.id || user.id === deck.cubeOwner);

  const { date } = deck;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const openDeleteModal = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
  };

  return (
    <a className="block py-1 px-2 hover:bg-bg-active hover:cursor-pointer" href={`/cube/deck/${deck.id}`}>
      <Flexbox direction="col">
        <Text sm semibold className="truncate flex-grow">
          {deck.name}
        </Text>
        <Flexbox direction="row" className="mb-2 text-text-secondary" justify="between">
          <Text sm className="truncate flex-grow">
            {'Drafted by '}
            <Username user={deck.owner} /> <TimeAgo date={date} />
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
              onClick={openDeleteModal}
            >
              <DeckDeleteModal
                toggle={closeDeleteModal}
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
