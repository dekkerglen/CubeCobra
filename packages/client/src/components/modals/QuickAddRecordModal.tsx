import React, { createRef, useState } from 'react';

import Record, { Match, Round } from '@utils/datatypes/Record';

import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';

import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface QuickAddRecordModalProps {
  record: Record;
  playerName: string;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

// Builds a single round of synthetic matches (vs "Unknown Opponent") so a quick
// W/L/D tally is captured without entering the full pairing history. The
// standings logic counts one win/loss/draw per match and ignores the unknown
// opponent, so the player's record totals come out correct.
const buildRound = (playerName: string, wins: number, losses: number, draws: number): Round => {
  const matches: Match[] = [];
  const push = (results: [number, number, number]) => matches.push({ p1: playerName, p2: 'Unknown Opponent', results });
  for (let i = 0; i < wins; i++) push([1, 0, 0]);
  for (let i = 0; i < losses; i++) push([0, 1, 0]);
  for (let i = 0; i < draws; i++) push([0, 0, 1]);
  return { matches };
};

const QuickAddRecordModal: React.FC<QuickAddRecordModalProps> = ({ isOpen, setOpen, record, playerName }) => {
  const formRef = createRef<HTMLFormElement>();
  const [wins, setWins] = useState<number>(0);
  const [losses, setLosses] = useState<number>(0);
  const [draws, setDraws] = useState<number>(0);

  const total = wins + losses + draws;
  const round = buildRound(playerName, wins, losses, draws);

  const numberField = (label: string, value: number, setValue: (value: number) => void) => (
    <Col xs={4} md={4}>
      <Text sm semibold>
        {label}
      </Text>
      <Input
        type="number"
        otherInputProps={{ min: 0 }}
        value={`${value}`}
        onChange={(e) => setValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
      />
    </Col>
  );

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>{`Quick add record for ${playerName}`}</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Text sm>
            Enter {playerName}&apos;s match record. This adds a round of results without the full pairing history.
          </Text>
          <Row>
            {numberField('Wins', wins, setWins)}
            {numberField('Losses', losses, setLosses)}
            {numberField('Draws', draws, setDraws)}
          </Row>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block disabled={total === 0}>
          Add Record
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/round/add/${record.id}`}
          formData={{ round: JSON.stringify(round) }}
          ref={formRef}
        ></CSRFForm>
      </ModalFooter>
    </Modal>
  );
};

export default QuickAddRecordModal;
