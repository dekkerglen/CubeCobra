import React, { createRef, useState } from 'react';

import Record, { Round } from '@utils/datatypes/Record';

import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';

import EditMatchRound from '../../records/EditMatchRound';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface AddMatchModalProps {
  record: Record;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const defaultRound = (record: Record): Round => {
  const round: Round = {
    matches: [],
  };

  for (let i = 0; i < record.players.length / 2; i++) {
    round.matches.push({
      p1: 'Unknown Opponent',
      p2: 'Unknown Opponent',
      results: [0, 0, 0],
    });
  }

  return round;
};

const AddRoundModal: React.FC<AddMatchModalProps> = ({ isOpen, setOpen, record }) => {
  const formRef = createRef<HTMLFormElement>();
  const [round, setRound] = useState<Round>(defaultRound(record));

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} xl>
      <ModalHeader setOpen={setOpen}>{`Add round to ${record.name}`}</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <EditMatchRound round={round} setRound={setRound} players={record.players} />
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block>
          Add Round
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

export default AddRoundModal;
