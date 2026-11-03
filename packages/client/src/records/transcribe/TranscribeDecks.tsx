import React, { useMemo, useState } from 'react';

import { CardDetails } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import Record from '@utils/datatypes/Record';

import { UncontrolledAlertProps } from 'components/base/Alert';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';

import UploadDeck from '../UploadDeck';
import UploadDeckFromPhoto from '../UploadDeckFromPhoto';
import { DeckBoard, TranscribeDeck } from './transcribeState';

interface TranscribeDecksProps {
  cube: Cube;
  record: Record;
  decks: { [playerIndex: number]: TranscribeDeck };
  setDeckBoard: (playerIndex: number, board: DeckBoard, update: React.SetStateAction<CardDetails[]>) => void;
  setAlerts: React.Dispatch<React.SetStateAction<UncontrolledAlertProps[]>>;
}

const summarize = (deck: TranscribeDeck | undefined): string => {
  if (!deck || deck.mainboard.length === 0) {
    return 'No deck yet';
  }
  const sideboard = deck.sideboard.length > 0 ? ` + ${deck.sideboard.length} sideboard` : '';
  return `${deck.mainboard.length} cards${sideboard}`;
};

const CardNameList: React.FC<{ title: string; cards: CardDetails[] }> = ({ title, cards }) => {
  if (cards.length === 0) {
    return null;
  }
  return (
    <Flexbox direction="col" gap="1">
      <Text sm semibold>
        {`${title} (${cards.length})`}
      </Text>
      <ul className="mb-0">
        {cards.map((card, index) => (
          <li key={index}>
            <Text sm>{card.name}</Text>
          </li>
        ))}
      </ul>
    </Flexbox>
  );
};

// One row per player, only one of them open. Collapsed rows mount nothing: the deck editor
// loads the cube's basics on mount, and a pod of eight would do that eight times over.
const TranscribeDecks: React.FC<TranscribeDecksProps> = ({ cube, record, decks, setDeckBoard, setAlerts }) => {
  // Open on the first player still missing a deck — the next one to transcribe.
  const [expanded, setExpanded] = useState<number>(() => {
    const firstDeckless = record.players.findIndex((_, index) => (decks[index]?.mainboard.length ?? 0) === 0);
    return firstDeckless === -1 ? 0 : firstDeckless;
  });

  const setters = useMemo(
    () =>
      record.players.map((_, index) => ({
        setMainboard: ((update: React.SetStateAction<CardDetails[]>) =>
          setDeckBoard(index, 'mainboard', update)) as React.Dispatch<React.SetStateAction<CardDetails[]>>,
        setSideboard: ((update: React.SetStateAction<CardDetails[]>) =>
          setDeckBoard(index, 'sideboard', update)) as React.Dispatch<React.SetStateAction<CardDetails[]>>,
      })),
    [record.players, setDeckBoard],
  );

  return (
    <Flexbox direction="col" gap="2">
      {record.players.map((player, index) => {
        const deck = decks[index];
        const open = expanded === index;

        return (
          <div key={index} data-testid="transcribe-deck-row">
            <Card>
              <CardHeader>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpanded(open ? -1 : index)}
                  aria-expanded={open}
                >
                  <Flexbox direction="row" justify="between" alignItems="center" gap="2">
                    <Text semibold>{player.name}</Text>
                    <Text sm className="text-text-secondary">
                      {`${summarize(deck)}${deck?.dirty ? ' • unsaved' : ''}`}
                    </Text>
                  </Flexbox>
                </button>
              </CardHeader>
              {open && (
                <CardBody>
                  {!deck || deck.editable ? (
                    <Flexbox direction="col" gap="2">
                      <UploadDeckFromPhoto
                        cube={cube}
                        setMainboardCards={setters[index].setMainboard}
                        setSideboardCards={setters[index].setSideboard}
                        setAlerts={setAlerts}
                      />
                      <UploadDeck
                        // This row is already bound to one player, so UploadDeck's picker has
                        // nothing to choose: it is handed a one-player record and a setter that
                        // does nothing, which leaves it showing whose deck is being entered.
                        selectedUser={1}
                        setSelectedUser={() => {}}
                        record={{ ...record, players: [player] }}
                        mainboardCards={deck?.mainboard ?? []}
                        setMainboardCards={setters[index].setMainboard}
                        sideboardCards={deck?.sideboard ?? []}
                        setSideboardCards={setters[index].setSideboard}
                        setAlerts={setAlerts}
                        cubeId={cube.id}
                      />
                    </Flexbox>
                  ) : (
                    <Flexbox direction="col" gap="2">
                      <Text sm className="text-text-secondary">
                        This record is attached to a played draft, so this deck is tied to the seat that drafted it and
                        cannot be re-entered here. Edit it in the deckbuilder instead.
                      </Text>
                      <CardNameList title="Mainboard" cards={deck.mainboard} />
                      <CardNameList title="Sideboard" cards={deck.sideboard} />
                    </Flexbox>
                  )}
                </CardBody>
              )}
            </Card>
          </div>
        );
      })}
    </Flexbox>
  );
};

export default TranscribeDecks;
