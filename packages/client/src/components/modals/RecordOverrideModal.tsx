import React, { createRef, useState } from 'react';

import Record, { playerRecord } from '@utils/datatypes/Record';

import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';

import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface RecordOverrideModalProps {
  record: Record;
  playerName: string;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

// Set a manual win/loss/draw record for a player. The override takes precedence
// over the match-derived total, so a record can be entered without logging
// individual matches. Detailed per-match results live on the Matches tab.
const RecordOverrideModal: React.FC<RecordOverrideModalProps> = ({ isOpen, setOpen, record, playerName }) => {
  const saveRef = createRef<HTMLFormElement>();
  const clearRef = createRef<HTMLFormElement>();
  const current = playerRecord(record, playerName);
  const hasOverride = !!record.overrides?.[playerName];

  const [wins, setWins] = useState<number>(current.wins);
  const [losses, setLosses] = useState<number>(current.losses);
  const [draws, setDraws] = useState<number>(current.draws);

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
      <ModalHeader setOpen={setOpen}>{`Record for ${playerName}`}</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Text sm>
            Set {playerName}&apos;s win/loss/draw directly. This overrides the total from match results. For detailed
            per-match results, use the{' '}
            <Link href={`/cube/record/${record.id}?tab=3`}>Matches tab</Link> instead.
          </Text>
          <Row>
            {numberField('Wins', wins, setWins)}
            {numberField('Losses', losses, setLosses)}
            {numberField('Draws', draws, setDraws)}
          </Row>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => saveRef.current?.submit()} color="primary" block>
          Save record
        </LoadingButton>
        {hasOverride && (
          <LoadingButton onClick={() => clearRef.current?.submit()} color="secondary" block>
            Use match results
          </LoadingButton>
        )}
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/override/${record.id}`}
          formData={{ player: playerName, wins: `${wins}`, losses: `${losses}`, draws: `${draws}` }}
          ref={saveRef}
        />
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/override/${record.id}`}
          formData={{ player: playerName, clear: '1' }}
          ref={clearRef}
        />
      </ModalFooter>
    </Modal>
  );
};

export default RecordOverrideModal;
