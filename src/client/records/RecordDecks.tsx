import React, { useContext } from 'react';

import { CardBody } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import DeckCard from 'components/DeckCard';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';
import Draft from 'datatypes/Draft';
import Record from 'datatypes/Record';

interface RecordDecksProps {
  record: Record;
  draft?: Draft;
}

const firstPlayerIndexWithDeck = (record: Record, draft: Draft | undefined): number => {
  if (!draft) return -1;

  for (let i = 0; i < record.players.length; i++) {
    const seat = draft.seats[i];
    if (seat.mainboard?.flat(3).length > 0) {
      return i;
    }
  }
  return -1;
};

const RecordDecks: React.FC<RecordDecksProps> = ({ record, draft }) => {
  const { cube } = useContext(CubeContext);
  const user = useContext(UserContext);
  const [selectedUserIndex, setSelectedUserIndex] = React.useState<number>(firstPlayerIndexWithDeck(record, draft));

  const isOwner = user && cube && user.id === cube.owner.id;

  if (record.players.length === 0) {
    return (
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text sm>{'No players have been added to this record yet.'}</Text>
        </Flexbox>
      </CardBody>
    );
  }

  if (!draft) {
    return (
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text sm>{'No draft data available for this record.'}</Text>
          {isOwner && <Link href={`/cube/records/uploaddeck/${record.id}`}>Upload a deck to this record</Link>}
        </Flexbox>
      </CardBody>
    );
  }

  return (
    <CardBody>
      <Flexbox direction="col" gap="2">
        {isOwner && <Link href={`/cube/records/uploaddeck/${record.id}`}>Upload another deck to this record</Link>}
        <Select
          value={`${selectedUserIndex}`}
          setValue={(value) => {
            const index = parseInt(value, 10);
            setSelectedUserIndex(index);
          }}
          label="View deck for player"
          options={record.players
            .map((player, index) => ({
              value: `${index}`,
              label: player.name,
            }))
            .filter((option) => draft.seats[parseInt(option.value, 10)]?.mainboard?.flat(3).length > 0)}
        />
        <DeckCard
          seat={draft.seats[selectedUserIndex]}
          draft={draft}
          view="draft"
          seatIndex={`${selectedUserIndex}`}
          hideComments
        />
      </Flexbox>
    </CardBody>
  );
};

export default RecordDecks;
