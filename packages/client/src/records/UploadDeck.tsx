import React, { useCallback, useContext, useRef, useState } from 'react';

import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import Record from '@utils/datatypes/Record';

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
import { getCard } from 'utils/cards/getCard';

interface UploadDeckProps {
  selectedUser: number;
  setSelectedUser: (userId: number) => void;
  record: Record;
  mainboardCards: CardDetails[];
  setMainboardCards: React.Dispatch<React.SetStateAction<CardDetails[]>>;
  sideboardCards: CardDetails[];
  setSideboardCards: React.Dispatch<React.SetStateAction<CardDetails[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<UncontrolledAlertProps[]>>;
  cubeId: string;
}

const UploadDeck: React.FC<UploadDeckProps> = ({
  selectedUser,
  setSelectedUser,
  record,
  mainboardCards,
  setMainboardCards,
  sideboardCards,
  setSideboardCards,
  setAlerts,
  cubeId,
}) => {
  const [allowCardsOutsideOfCube, setAllowCardsOutsideOfCube] = useState<boolean>(false);
  const [addToSideboard, setAddToSideboard] = useState<boolean>(false);
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
        if (addToSideboard) {
          setSideboardCards((prevCards) => [...prevCards, card]);
        } else {
          setMainboardCards((prevCards) => [...prevCards, card]);
        }
        setCardNameValue('');

        if (removeRef.current) {
          removeRef.current.focus();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [csrfFetch, setAlerts, setMainboardCards, setSideboardCards, addToSideboard],
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
      <Flexbox direction="row" justify="start" gap="2">
        <Checkbox
          label="Use Cards Outside of Cube"
          checked={allowCardsOutsideOfCube}
          setChecked={(value) => setAllowCardsOutsideOfCube(value)}
        />
        <Checkbox label="Add to Sideboard" checked={addToSideboard} setChecked={(value) => setAddToSideboard(value)} />
      </Flexbox>
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
          placeholder={addToSideboard ? 'Card to Add to Sideboard' : 'Card to Add to Mainboard'}
          autoComplete="off"
          data-lpignore
          className="square-right"
        />
        <Button color="primary" disabled={cardNameValue.length === 0} onClick={(e) => handleAdd(e, cardNameValue)}>
          <span className="text-nowrap">Add Card</span>
        </Button>
      </Flexbox>
      {mainboardCards.length > 0 && (
        <>
          <Text sm semibold>
            Mainboard ({mainboardCards.length} card{mainboardCards.length > 1 ? 's' : ''})
          </Text>
          <Text sm>Click on a card to remove it.</Text>
          <CardGrid
            cards={mainboardCards.map(detailsToCard)}
            xs={4}
            md={8}
            xl={10}
            onClick={(_, index) => {
              setMainboardCards((prevCards) => prevCards.filter((_, i) => i !== index));
              hideCard();
            }}
          />
        </>
      )}
      {sideboardCards.length > 0 && (
        <>
          <Text sm semibold className="mt-2">
            Sideboard ({sideboardCards.length} card{sideboardCards.length > 1 ? 's' : ''})
          </Text>
          <Text sm>Click on a card to remove it.</Text>
          <CardGrid
            cards={sideboardCards.map(detailsToCard)}
            xs={4}
            md={8}
            xl={10}
            onClick={(_, index) => {
              setSideboardCards((prevCards) => prevCards.filter((_, i) => i !== index));
              hideCard();
            }}
          />
        </>
      )}
    </>
  );
};

export default UploadDeck;
