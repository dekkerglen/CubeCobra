import React, { useCallback, useContext, useRef, useState } from 'react';

import { UncontrolledAlertProps } from 'components/base/Alert';
import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import CardGrid from 'components/card/CardGrid';
import AutocardContext from 'contexts/AutocardContext';
import { CSRFContext } from 'contexts/CSRFContext';
import { CardDetails } from 'datatypes/Card';
import Record from 'datatypes/Record';
import { getCard } from 'utils/cards/getCard';
import { detailsToCard } from 'utils/cardutil';

interface UploadDeckProps {
  selectedUser: number;
  setSelectedUser: (userId: number) => void;
  record: Record;
  cards: CardDetails[];
  setCards: React.Dispatch<React.SetStateAction<CardDetails[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<UncontrolledAlertProps[]>>;
  cubeId: string;
}

const UploadDeck: React.FC<UploadDeckProps> = ({
  selectedUser,
  setSelectedUser,
  record,
  cards,
  setCards,
  setAlerts,
  cubeId,
}) => {
  const [allowCardsOutsideOfCube, setAllowCardsOutsideOfCube] = useState<boolean>(false);
  const { csrfFetch } = useContext(CSRFContext);
  const removeRef = useRef<HTMLInputElement>(null);
  const { hideCard } = useContext(AutocardContext);
  const [cardNameValue, setCardNameValue] = useState<string>('');

  const handleAdd = useCallback(
    async (event: React.FormEvent, match: string) => {
      event.preventDefault();

      try {
        const card = await getCard(csrfFetch, '', match, setAlerts);
        if (!card) {
          return;
        }
        setCards((prevCards) => [...prevCards, card]);
        setCardNameValue('');

        if (removeRef.current) {
          removeRef.current.focus();
        }
      } catch (e) {
        // eslint-disable-next-line no-console -- Debugging
        console.error(e);
      }
    },
    [csrfFetch, setAlerts, setCards],
  );

  return (
    <>
      <Select
        value={`${selectedUser}`}
        setValue={(value) => {
          const userId = parseInt(value, 10);
          setSelectedUser(userId);
        }}
        label="Upload deck for player"
        options={[
          { value: '0', label: 'Select a player' },
          ...record.players.map((player, index) => ({
            value: `${index + 1}`,
            label: player.name,
          })),
        ]}
      />
      <Checkbox
        label="Use Cards Outside of Cube"
        checked={allowCardsOutsideOfCube}
        setChecked={(value) => setAllowCardsOutsideOfCube(value)}
      />
      <Flexbox direction="row" justify="start" gap="2">
        <AutocompleteInput
          cubeId={cubeId}
          treeUrl={allowCardsOutsideOfCube ? '/cube/api/cardnames' : `/cube/api/cubecardnames/${cubeId}/mainboard`}
          treePath="cardnames"
          type="text"
          innerRef={removeRef}
          name="remove"
          value={cardNameValue}
          setValue={setCardNameValue}
          onSubmit={(e, val) => handleAdd(e, val!)}
          placeholder="Card to Add"
          autoComplete="off"
          data-lpignore
          className="square-right"
        />
        <Button color="primary" disabled={cardNameValue.length === 0} onClick={(e) => handleAdd(e, cardNameValue)}>
          <span className="text-nowrap">Add Card</span>
        </Button>
      </Flexbox>
      {cards.length > 0 && (
        <>
          <Text sm>
            {cards.length} card{cards.length > 1 ? 's' : ''} added to deck. Click on a card to remove it.
          </Text>
          <CardGrid
            cards={cards.map(detailsToCard)}
            xs={4}
            md={8}
            xl={10}
            onClick={(_, index) => {
              setCards((prevCards) => prevCards.filter((_, i) => i !== index));
              hideCard();
            }}
          />
        </>
      )}
    </>
  );
};

export default UploadDeck;
