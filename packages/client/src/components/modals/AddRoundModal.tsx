import React, { createRef, useEffect, useMemo, useState } from 'react';

import Record, { Round } from '@utils/datatypes/Record';
import { BYE, generatePairings, PairingMethod } from '@utils/records/pairings';
import { roundProblems, unreportedMatches } from '@utils/records/roundChecks';
import { computeStandings } from '@utils/records/standings';

import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';

import EditMatchRound, { emptyMatch } from '../../records/EditMatchRound';
import { giveBye, isPaired, pairTogether, unpair } from '../../records/manualPairing';
import PairingMethodControl, { PairingChoice } from '../../records/PairingMethodControl';
import SeatingTable, { PairingList } from '../../records/SeatingTable';
import { Seat } from '../../records/seating';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface AddMatchModalProps {
  record: Record;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const FIRST_ROUND_METHODS: PairingChoice[] = ['across', 'random', 'manual'];
const LATER_ROUND_METHODS: PairingChoice[] = ['record', 'random', 'manual'];

// Pre-paired from the rounds so far: across the table for the first round and by record after
// that, unless another method is chosen. A pod too small to pair still opens with a row to fill
// in, since the server rejects a round with no matches.
const pairedRound = (record: Record, method?: PairingMethod): Round => {
  const pairings = generatePairings(record.players, record.matches ?? [], record.dropped, { method });
  return { matches: pairings.length > 0 ? pairings : [emptyMatch()] };
};

const formatRecord = ({ wins, losses, draws }: { wins: number; losses: number; draws: number }) =>
  `${wins}-${losses}${draws > 0 ? `-${draws}` : ''}`;

const AddRoundModal: React.FC<AddMatchModalProps> = ({ isOpen, setOpen, record }) => {
  const formRef = createRef<HTMLFormElement>();
  const isFirstRound = !(record.matches ?? []).some((existing) => existing.matches.length > 0);
  const defaultMethod: PairingMethod = isFirstRound ? 'across' : 'record';
  const [method, setMethod] = useState<PairingChoice>(defaultMethod);
  const [round, setRound] = useState<Round>(() => pairedRound(record));
  const [selected, setSelected] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);

  // withModal keeps this mounted while closed, so pair again on every open: the results
  // reported since the page loaded are what the next round's pairings depend on.
  useEffect(() => {
    if (isOpen) {
      setMethod(defaultMethod);
      setRound(pairedRound(record));
      setSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const seats: Seat[] = useMemo(() => record.players.map((player, origin) => ({ player, origin })), [record.players]);
  const standings = useMemo(
    () => new Map(computeStandings(record).map((standing) => [standing.name, standing])),
    [record],
  );
  const dropped = useMemo(() => new Set(record.dropped ?? []), [record.dropped]);
  const roundNumber = (record.matches ?? []).length + 1;
  // The table needs players to sit at it; a record without them is paired as a list.
  const onTable = record.players.length >= 2;

  const choose = (next: PairingChoice) => {
    setMethod(next);
    setSelected(null);
    if (next !== 'manual') {
      setRound(pairedRound(record, next));
    }
  };

  const editMatches = (edit: (matches: Round['matches']) => Round['matches']) => {
    setRound((previous) => ({ matches: edit(previous.matches) }));
    setMethod('manual');
    setSelected(null);
  };

  // Picking one player and then another pairs them, whatever method made the rest of the round:
  // a suggested round is adjusted by hand from there.
  const selectSeat = (index: number) => {
    const name = record.players[index]!.name;
    if (selected === null || selected === index) {
      setSelected(selected === index ? null : index);
      return;
    }
    const first = record.players[selected]!.name;
    if (dropped.has(first) || dropped.has(name)) {
      setSelected(index);
      return;
    }
    const [p1, p2] = selected < index ? [first, name] : [name, first];
    editMatches((matches) => pairTogether(matches, p1, p2));
  };

  const selectedName = selected === null ? null : record.players[selected]!.name;
  const unpaired = record.players
    .map((player) => player.name)
    .filter((name) => !dropped.has(name) && !isPaired(round.matches, name));
  const realMatches = round.matches.filter((match) => match.p1 !== BYE && match.p2 !== BYE);
  const problems = roundProblems(round, record.players);
  // Pairing by record before the last round is in counts its open matches as never played.
  const unreported = isFirstRound ? [] : unreportedMatches(record.matches.at(-1));

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} xl>
      <ModalHeader setOpen={setOpen}>{`Add round to ${record.name}`}</ModalHeader>
      <ModalBody className="flex flex-col gap-3">
        {onTable && (
          <Flexbox direction="col" gap="4" className="md:flex-row md:items-start">
            <div className="min-w-0 flex-1">
              <SeatingTable
                seats={seats}
                pairings={round.matches}
                selected={selected}
                onSelect={selectSeat}
                center={
                  <>
                    <Text xxl semibold className="rounded-md bg-bg-active px-2">{`Round ${roundNumber}`}</Text>
                    <Text xs className="text-text-secondary">
                      {`${realMatches.length} match${realMatches.length === 1 ? '' : 'es'}`}
                    </Text>
                  </>
                }
                detail={(player) =>
                  dropped.has(player.name)
                    ? 'dropped'
                    : formatRecord(standings.get(player.name) ?? { wins: 0, losses: 0, draws: 0 })
                }
                isInactive={(player) => dropped.has(player.name)}
              />
            </div>
            <Flexbox direction="col" gap="3" className="md:w-80 md:shrink-0">
              <PairingMethodControl
                methods={isFirstRound ? FIRST_ROUND_METHODS : LATER_ROUND_METHODS}
                value={method}
                onChange={choose}
                onRedraw={() => choose('random')}
              />
              {selectedName ? (
                <Flexbox direction="col" gap="1" className="rounded-md border border-border p-2">
                  <Text sm semibold>
                    {selectedName}
                  </Text>
                  {dropped.has(selectedName) ? (
                    <Text sm className="text-text-secondary">
                      Has dropped from the event, so can't be paired.
                    </Text>
                  ) : (
                    <>
                      <Text sm className="text-text-secondary">
                        Pick another player to pair them together.
                      </Text>
                      <Flexbox direction="row" gap="3" wrap="wrap">
                        <button
                          type="button"
                          className="text-sm font-medium text-link hover:text-link-active"
                          onClick={() => editMatches((matches) => giveBye(matches, selectedName))}
                        >
                          Give the Bye
                        </button>
                        {isPaired(round.matches, selectedName) && (
                          <button
                            type="button"
                            className="text-sm font-medium text-danger hover:underline"
                            onClick={() => editMatches((matches) => unpair(matches, selectedName))}
                          >
                            Unpair
                          </button>
                        )}
                      </Flexbox>
                    </>
                  )}
                </Flexbox>
              ) : (
                method !== 'manual' && (
                  <Text xs className="text-text-secondary">
                    Pick two players on the table to swap in a pairing of your own.
                  </Text>
                )
              )}
              <PairingList
                seats={seats}
                pairings={round.matches}
                label={`Round ${roundNumber} pairings`}
                emptyMessage="Nobody is paired yet."
              />
              {unpaired.length > 0 && <Text sm className="text-danger">{`Not paired: ${unpaired.join(', ')}.`}</Text>}
              <Flexbox direction="row" gap="3" wrap="wrap">
                {method === 'manual' && round.matches.length > 0 && (
                  <button
                    type="button"
                    className="text-sm font-medium text-link hover:text-link-active"
                    onClick={() => editMatches(() => [])}
                  >
                    Clear All Pairings
                  </button>
                )}
                <button
                  type="button"
                  className="text-sm font-medium text-link hover:text-link-active"
                  aria-expanded={showList}
                  onClick={() => setShowList((open) => !open)}
                >
                  {showList ? 'Hide the List' : 'Edit as a List'}
                </button>
              </Flexbox>
            </Flexbox>
          </Flexbox>
        )}
        {unreported.length > 0 && (
          <Text sm className="rounded-md border border-amber-500 bg-amber-500/10 p-2">
            {`Round ${roundNumber - 1} still has ${unreported.length} match${unreported.length === 1 ? '' : 'es'} without a result (${unreported
              .map((match) => `${match.p1} v ${match.p2}`)
              .join(', ')}). Records here count ${unreported.length === 1 ? 'it' : 'them'} as not played yet.`}
          </Text>
        )}
        {problems.length > 0 && (
          <ul aria-label="Problems with this round" className="flex flex-col gap-1">
            {problems.map((problem) => (
              <li key={problem}>
                <Text sm className="text-danger">
                  {problem}
                </Text>
              </li>
            ))}
          </ul>
        )}
        {/* The list takes results too, for a round being entered after it was played. */}
        {(showList || !onTable) && (
          <EditMatchRound
            round={round}
            setRound={(next) => {
              setRound(next);
              setMethod('manual');
            }}
            players={record.players}
          />
        )}
      </ModalBody>
      <ModalFooter>
        <LoadingButton
          onClick={() => formRef.current?.submit()}
          color="primary"
          block
          disabled={round.matches.length === 0 || problems.length > 0}
        >
          Add Round
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/round/add/${record.id}`}
          // The round count this was paired from, so a round added elsewhere meanwhile isn't doubled.
          formData={{ round: JSON.stringify(round), expectedRounds: `${record.matches?.length ?? 0}` }}
          ref={formRef}
        ></CSRFForm>
      </ModalFooter>
    </Modal>
  );
};

export default AddRoundModal;
