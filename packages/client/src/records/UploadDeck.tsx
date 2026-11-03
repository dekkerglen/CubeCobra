import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import Record from '@utils/datatypes/Record';
import { DecklistBoard, parseDecklist } from '@utils/decklistParsing';

import Alert, { UncontrolledAlertProps } from 'components/base/Alert';
import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';
import CardGrid from 'components/card/CardGrid';
import BasicsModal from 'components/modals/BasicsModal';
import { CSRFContext } from 'contexts/CSRFContext';
import { cardNameMatches, cubeCardNameMatches } from 'utils/cardAutocomplete';
import { getCard } from 'utils/cards/getCard';
import { getCards } from 'utils/cards/getCards';

// Select sentinel for "add a new player inline" (vs. an existing player index).
export const NEW_PLAYER = -1;

// Section markers written back into the textarea alongside lines that failed to resolve, so a
// retried paste keeps each line on the board it was parsed onto. Both round-trip through
// parseDecklist.
const BOARD_MARKER_LINES: { [board in DecklistBoard]: string } = {
  mainboard: 'Mainboard',
  sideboard: 'Sideboard',
};

interface UploadDeckProps {
  selectedUser: number;
  setSelectedUser: (userId: number) => void;
  // Whose deck this is, as a picker. A surface that already binds the editor to one player —
  // the transcription workspace renders one per row — answers that question by its position,
  // so it turns the picker off rather than asking again.
  showPlayerPicker?: boolean;
  // Optional: when provided, an inline "+ Add new player" option is offered.
  newPlayerName?: string;
  setNewPlayerName?: (name: string) => void;
  // Optional: when provided, picking an existing player offers a field to correct
  // their name (or swap it for an @account handle).
  renamePlayer?: string;
  setRenamePlayer?: (name: string) => void;
  record: Record;
  mainboardCards: CardDetails[];
  setMainboardCards: React.Dispatch<React.SetStateAction<CardDetails[]>>;
  sideboardCards: CardDetails[];
  setSideboardCards: React.Dispatch<React.SetStateAction<CardDetails[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<UncontrolledAlertProps[]>>;
  cubeId: string;
  // Optional: when provided, the pasted text and the lines that failed to resolve live in
  // the caller instead of here, so they survive this editor being unmounted. A surface that
  // owns a whole page has no need for them and keeps the local state below.
  decklistText?: string;
  setDecklistText?: (text: string) => void;
  parseErrors?: string[];
  setParseErrors?: (errors: string[]) => void;
}

const UploadDeck: React.FC<UploadDeckProps> = ({
  selectedUser,
  setSelectedUser,
  showPlayerPicker = true,
  newPlayerName,
  setNewPlayerName,
  renamePlayer,
  setRenamePlayer,
  record,
  mainboardCards,
  setMainboardCards,
  sideboardCards,
  setSideboardCards,
  setAlerts,
  cubeId,
  decklistText: controlledDecklistText,
  setDecklistText: setControlledDecklistText,
  parseErrors: controlledParseErrors,
  setParseErrors: setControlledParseErrors,
}) => {
  const [allowCardsOutsideOfCube, setAllowCardsOutsideOfCube] = useState<boolean>(false);
  // Which board everything on this surface lands on — one typed card, a modal of basics, or a
  // paste with no section marker of its own. Shared by both columns, so it sits above them.
  const [targetBoard, setTargetBoard] = useState<DecklistBoard>('mainboard');
  const addToSideboard = targetBoard === 'sideboard';
  const { csrfFetch } = useContext(CSRFContext);
  const removeRef = useRef<HTMLInputElement>(null);
  const [cardNameValue, setCardNameValue] = useState<string>('');
  const [localDecklistText, setLocalDecklistText] = useState<string>('');
  const [localParseErrors, setLocalParseErrors] = useState<string[]>([]);
  const decklistText = controlledDecklistText ?? localDecklistText;
  const setDecklistText = setControlledDecklistText ?? setLocalDecklistText;
  const parseErrors = controlledParseErrors ?? localParseErrors;
  const setParseErrors = setControlledParseErrors ?? setLocalParseErrors;
  const [isParsing, setIsParsing] = useState<boolean>(false);
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

  // Pasted decklists go through the same line parser the cube bulk importer uses, so quantities,
  // set codes and collector numbers are handled identically, and "Sideboard" style section markers
  // split the paste across boards. Every name is resolved in one request.
  const handleParseDecklist = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        return;
      }

      setIsParsing(true);
      setParseErrors([]);

      const defaultBoard: DecklistBoard = addToSideboard ? 'sideboard' : 'mainboard';

      // Comment lines ("// Lands", as Cockatrice and TappedOut emit) parse as card lines. Drop them
      // rather than reporting them as cards that couldn't be found.
      const entries = parseDecklist(text, defaultBoard).filter((entry) => !entry.name.startsWith('//'));

      if (entries.length === 0) {
        // Nothing but markers and comments: say so rather than silently emptying the box.
        setParseErrors(['Could not find any cards in the pasted text.']);
        setIsParsing(false);
        return;
      }

      try {
        const resolved = await getCards(
          csrfFetch,
          '',
          entries.map((entry) => entry.name),
        );

        const errors: string[] = [];
        const erroredLines: string[] = [];
        const mainboardToAdd: CardDetails[] = [];
        const sideboardToAdd: CardDetails[] = [];
        // The board the retained text is sitting in as it's rebuilt. Markers are re-emitted whenever
        // it changes, so a retried paste routes its surviving lines to the boards they came from.
        let retainedBoard = defaultBoard;

        entries.forEach((entry, index) => {
          const card = resolved[index];
          if (!card) {
            errors.push(`Could not find card: "${entry.line}"`);
            if (entry.board !== retainedBoard) {
              erroredLines.push(BOARD_MARKER_LINES[entry.board]);
              retainedBoard = entry.board;
            }
            erroredLines.push(entry.line);
            return;
          }

          const board = entry.board === 'sideboard' ? sideboardToAdd : mainboardToAdd;
          for (let i = 0; i < entry.count; i++) {
            board.push(card);
          }
        });

        if (mainboardToAdd.length > 0) {
          setMainboardCards((prevCards) => [...prevCards, ...mainboardToAdd]);
        }
        if (sideboardToAdd.length > 0) {
          setSideboardCards((prevCards) => [...prevCards, ...sideboardToAdd]);
        }

        setParseErrors(errors);
        // Keep only errored lines in the textarea, so the paste can be fixed up and retried.
        setDecklistText(erroredLines.join('\n'));
      } catch (e) {
        console.error(e);
        // The paste is left alone so it can be retried once the lookup works again.
        setParseErrors(['Could not look these cards up. Please try again.']);
      } finally {
        setIsParsing(false);
      }
    },
    [csrfFetch, setMainboardCards, setSideboardCards, setDecklistText, setParseErrors, addToSideboard],
  );

  return (
    <>
      {showPlayerPicker && (
        <Select
          value={`${selectedUser}`}
          setValue={(value) => {
            const userId = parseInt(value, 10);
            setSelectedUser(userId);
            const player = record.players[userId - 1];
            setRenamePlayer?.(player ? (player.userId ? `@${player.name}` : player.name) : '');
          }}
          id="upload-deck-player"
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
      )}
      {showPlayerPicker && selectedUser === NEW_PLAYER && setNewPlayerName && (
        <Input
          type="text"
          value={newPlayerName ?? ''}
          onChange={(e) => setNewPlayerName(e.target.value)}
          placeholder="New player name"
          autoComplete="off"
        />
      )}
      {showPlayerPicker && selectedUser > 0 && setRenamePlayer && (
        <Input
          type="text"
          label="Name on this record (fix a misspelling, or use @username to link your account)"
          value={renamePlayer ?? ''}
          onChange={(e) => setRenamePlayer(e.target.value)}
          placeholder="Player name"
          autoComplete="off"
        />
      )}
      {/* One board selector above both columns: typing a card, adding basics and parsing a
          paste all land on the same board, and two copies of the control could disagree. */}
      <Flexbox direction="row" justify="start" gap="3" alignItems="end" wrap="wrap">
        <Select
          id="upload-deck-board"
          label="Add to"
          value={targetBoard}
          setValue={(value) => setTargetBoard(value as DecklistBoard)}
          options={[
            { value: 'mainboard', label: 'Mainboard' },
            { value: 'sideboard', label: 'Sideboard' },
          ]}
          dense
        />
        <Checkbox
          label="Use Cards Outside of Cube"
          checked={allowCardsOutsideOfCube}
          setChecked={(value) => setAllowCardsOutsideOfCube(value)}
        />
      </Flexbox>
      {/* Two ways in, side by side rather than stacked: typing cards one at a time and pasting
          a list are alternatives, and stacking them buried the paste box below a fold while
          leaving both at a width neither needs. */}
      <Flexbox direction="row" gap="4" className="items-stretch flex-col md:flex-row">
        <Flexbox direction="col" gap="2" className="md:w-1/2 min-w-0">
          <Text sm semibold>
            Add cards one at a time
          </Text>
          <Flexbox direction="row" justify="start" gap="2">
            <AutocompleteInput
              cubeId={cubeId}
              getMatches={
                allowCardsOutsideOfCube ? cardNameMatches(false, true) : cubeCardNameMatches(cubeId, 'mainboard')
              }
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
          </Flexbox>
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

        <Flexbox direction="col" gap="2" className="md:w-1/2 min-w-0">
          <Text sm semibold>
            Paste a decklist
          </Text>
          <Text sm className="text-text-secondary">
            One card per line, with an optional quantity like "2x Island". A "Sideboard" line sends everything below it
            to the sideboard.
          </Text>
          <TextArea
            value={decklistText}
            onChange={(e) => setDecklistText(e.target.value)}
            placeholder={`Paste your decklist here...

e.g.:
2x Lightning Bolt
4 Island
Counterspell

Sideboard
2 Pyroblast`}
            rows={8}
          />
          <Button
            color="primary"
            disabled={!decklistText.trim() || isParsing}
            onClick={() => handleParseDecklist(decklistText)}
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
            }}
          />
        </>
      )}
    </>
  );
};

export default UploadDeck;
