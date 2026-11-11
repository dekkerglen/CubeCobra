import React, { createRef, useEffect, useMemo, useState } from 'react';

import { TrophyIcon } from '@primer/octicons-react';
import Record, { formatRecord } from '@utils/datatypes/Record';
import { unreportedMatches } from '@utils/records/roundChecks';
import { computeStandings } from '@utils/records/standings';
import classNames from 'classnames';

import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';

import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface FinishTournamentModalProps {
  // The record as the page has it live, so results reported since it loaded decide the winner.
  record: Record;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

/**
 * Confirms finishing an event: the standings it ends on, who takes the trophy (the leader,
 * unless the organiser says otherwise), and a warning if any match still has no result.
 */
const FinishTournamentModal: React.FC<FinishTournamentModalProps> = ({ isOpen, setOpen, record }) => {
  const formRef = createRef<HTMLFormElement>();
  const standings = useMemo(() => computeStandings(record), [record]);
  const leader = standings[0]?.name;
  const [trophy, setTrophy] = useState<string[]>(leader ? [leader] : []);
  const unreported = unreportedMatches(record.matches.at(-1));

  // withModal keeps this mounted while closed: start from the current leader on every open.
  useEffect(() => {
    if (isOpen) {
      setTrophy(leader ? [leader] : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggle = (name: string) =>
    setTrophy((previous) => (previous.includes(name) ? previous.filter((held) => held !== name) : [...previous, name]));

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>Finish Tournament</ModalHeader>
      <ModalBody className="flex flex-col gap-3">
        <Text sm className="text-text-secondary">
          The standings below become final, the clock stops, and pairing and drops are put away. You can reopen the
          tournament later.
        </Text>
        {unreported.length > 0 && (
          <Text sm className="rounded-md border border-amber-500 bg-amber-500/10 p-2">
            {`Round ${record.matches.length} still has ${unreported.length} match${unreported.length === 1 ? '' : 'es'} without a result (${unreported
              .map((match) => `${match.p1} v ${match.p2}`)
              .join(', ')}). ${unreported.length === 1 ? 'It counts' : 'They count'} as not played.`}
          </Text>
        )}
        <ul
          aria-label="Final standings"
          className="flex flex-col divide-y divide-border rounded-md border border-border"
        >
          {standings.map((standing) => {
            const holds = trophy.includes(standing.name);
            return (
              <li key={standing.name} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-right text-sm tabular-nums text-text-secondary">{standing.rank}</span>
                <span className={classNames('grow truncate', { 'font-semibold': standing.rank === 1 })}>
                  {standing.name}
                </span>
                <span className="text-sm tabular-nums text-text-secondary">{formatRecord(standing)}</span>
                <span className="w-12 text-right text-sm font-semibold tabular-nums">{`${standing.points} pts`}</span>
                <button
                  type="button"
                  aria-pressed={holds}
                  aria-label={`Trophy for ${standing.name}`}
                  title={holds ? 'Takes a trophy' : 'Give a trophy'}
                  onClick={() => toggle(standing.name)}
                  className={classNames('rounded p-1 transition-colors', {
                    'text-amber-500': holds,
                    'text-text-secondary/40 hover:text-text-secondary': !holds,
                  })}
                >
                  <TrophyIcon size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block>
          Finish Tournament
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/finish/${record.id}`}
          formData={{ trophy: JSON.stringify(trophy) }}
          ref={formRef}
        ></CSRFForm>
      </ModalFooter>
    </Modal>
  );
};

export default FinishTournamentModal;
