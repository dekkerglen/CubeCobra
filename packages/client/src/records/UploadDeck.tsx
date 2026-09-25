import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import Record from '@utils/datatypes/Record';

import Alert, { UncontrolledAlertProps } from 'components/base/Alert';
import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import Collapse from 'components/base/Collapse';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';
import CardGrid from 'components/card/CardGrid';
import BasicsModal from 'components/modals/BasicsModal';
import AutocardContext from 'contexts/AutocardContext';
import { CSRFContext } from 'contexts/CSRFContext';
import { cardNameMatches, cubeCardNameMatches } from 'utils/cardAutocomplete';
import { getCard } from 'utils/cards/getCard';

// Select sentinel for "add a new player inline" (vs. an existing player index).
export const NEW_PLAYER = -1;

interface UploadDeckProps {
  selectedUser: number;
  setSelectedUser: (userId: number) => void;
  // Optional: when provided, an inline "+ Add new player" option is offered.
  newPlayerName?: string;
  setNewPlayerName?: (name: string) => void;
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
  newPlayerName,
  setNewPlayerName,
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
  const [decklistText, setDecklistText] = useState<string>('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [showPasteForm, setShowPasteForm] = useState<boolean>(false);
  // The cube's basic lands, fed to the same Add Basic Lands modal the deckbuilder
  // uses. They live on their own board, so they're absent from the cube autocomplete
  // and tedious to type a mana base out of.
  const [basicDetails, setBasicDetails] = useState<CardDetails[]>([]);
  const [basicsOpen, setBasicsOpen] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const poolResponse = await csrfFetch(`/cube/api/cubecardpool/${cubeId}`, { method: 'GET' });
        const pool = await poolResponse.json();
        const basics: { cardID: string; name: string }[] = pool?.success === 'true' ? (pool.basics ?? []) : [];
        if (cancelled || basics.length === 0) {
          return;
        }

        // One request for every basic's details — the modal needs images, and the
        // resolved details are what get appended to the deck.
        const detailsResponse = await csrfFetch('/cube/api/getdetailsforcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: basics.map((basic) => basic.cardID) }),
        });
        const json = await detailsResponse.json();
        if (!cancelled && json?.success === 'true') {
          setBasicDetails((json.details ?? []).filter(Boolean));
        }
      } catch {
        // Adding basics is a convenience — the rest of the editor works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [csrfFetch, cubeId]);

  // The modal addresses cards by index, so hand it one array: the current deck
  // followed by the basics. `deck` is what its Calculate button reads to suggest a
  // mana base.
  const basicsModalCards = useMemo(
    () => [...mainboardCards, ...basicDetails].map(detailsToCard),
    [mainboardCards, basicDetails],
  );
  const basicsModalDeck = useMemo(() => mainboardCards.map((_, index) => index), [mainboardCards]);
  const basicsModalBasics = useMemo(
    () => basicDetails.map((_, index) => mainboardCards.length + index),
    [basicDetails, mainboardCards.length],
  );

  // counts[i] copies of basicDetails[i], in the modal's own order.
  const handleAddBasics = useCallback(
    (counts: number[]) => {
      const cardsToAdd = basicDetails.flatMap((details, index) =>
        Array.from({ length: counts[index] ?? 0 }, () => details),
      );
      if (cardsToAdd.length === 0) {
        return;
      }
      if (addToSideboard) {
        setSideboardCards((prevCards) => [...prevCards, ...cardsToAdd]);
      } else {
        setMainboardCards((prevCards) => [...prevCards, ...cardsToAdd]);
      }
    },
    [basicDetails, addToSideboard, setMainboardCards, setSideboardCards],
  );

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

  const parseDecklist = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        return;
      }

      setIsParsing(true);
      setParseErrors([]);

      const lines = text.match(/[^\r\n]+/g) || [];
      const errors: string[] = [];
      const erroredLines: string[] = [];
      const cardsToAdd: CardDetails[] = [];

      for (const line of lines) {
        const item = line.toLowerCase().trim();
        if (!item) continue;

        // Parse quantity (e.g., "2x cardname" or "2 cardname")
        const numericMatch = item.match(/([0-9]+)x?\s+(.*)/);
        const cardName = numericMatch ? numericMatch[2] : item;
        const quantity = numericMatch ? parseInt(numericMatch[1], 10) : 1;

        try {
          const card = await getCard(csrfFetch, '', cardName, setAlerts);
          if (card) {
            // Add the card 'quantity' times
            for (let i = 0; i < quantity; i++) {
              cardsToAdd.push(card);
            }
          } else {
            errors.push(`Could not find card: "${line}"`);
            erroredLines.push(line);
          }
        } catch {
          errors.push(`Error parsing line: "${line}"`);
          erroredLines.push(line);
        }
      }

      // Add all found cards to the appropriate list
      if (addToSideboard) {
        setSideboardCards((prevCards) => [...prevCards, ...cardsToAdd]);
      } else {
        setMainboardCards((prevCards) => [...prevCards, ...cardsToAdd]);
      }

      setParseErrors(errors);
      setIsParsing(false);

      // Keep only errored lines in the textarea
      setDecklistText(erroredLines.join('\n'));
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
          ...(setNewPlayerName ? [{ value: `${NEW_PLAYER}`, label: '+ Add new player' }] : []),
        ]}
      />
      {selectedUser === NEW_PLAYER && setNewPlayerName && (
        <Input
          type="text"
          value={newPlayerName ?? ''}
          onChange={(e) => setNewPlayerName(e.target.value)}
          placeholder="New player name"
          autoComplete="off"
        />
      )}
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
          getMatches={allowCardsOutsideOfCube ? cardNameMatches(false, true) : cubeCardNameMatches(cubeId, 'mainboard')}
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
          <span className="text-nowrap">Add Cards</span>
        </Button>
        {basicDetails.length > 0 && (
          <>
            <Button color="accent" onClick={() => setBasicsOpen(true)}>
              <span className="text-nowrap">Add Basic Lands</span>
            </Button>
            {/* Rendered only once the basics have loaded: the modal seeds its per-land
                counts from this list on mount. */}
            <BasicsModal
              isOpen={basicsOpen}
              setOpen={setBasicsOpen}
              addBasics={handleAddBasics}
              deck={basicsModalDeck}
              basics={basicsModalBasics}
              cards={basicsModalCards}
            />
          </>
        )}
      </Flexbox>
      <Button color="accent" onClick={() => setShowPasteForm(!showPasteForm)} block className="mt-2">
        {showPasteForm ? 'Hide' : 'Show'} Paste Decklist
      </Button>

      <Collapse isOpen={showPasteForm}>
        <Flexbox direction="col" gap="2" className="mt-2">
          <Text sm>Acceptable formats: one card per line, or with quantity like "2x Island"</Text>
          <TextArea
            value={decklistText}
            onChange={(e) => setDecklistText(e.target.value)}
            placeholder={`Paste your decklist here...

e.g.:
2x Lightning Bolt
4 Island
Counterspell`}
            rows={8}
          />
          <Button
            color="primary"
            disabled={!decklistText.trim() || isParsing}
            onClick={() => parseDecklist(decklistText)}
            block
          >
            {isParsing ? 'Parsing...' : `Parse and Add to ${addToSideboard ? 'Sideboard' : 'Mainboard'}`}
          </Button>
          {parseErrors.length > 0 && (
            <Alert color="warning">
              <Text semibold>Could not parse the following lines:</Text>
              <ul className="mb-0">
                {parseErrors.map((error, index) => (
                  <li key={index}>
                    <Text sm>{error}</Text>
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </Flexbox>
      </Collapse>
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
