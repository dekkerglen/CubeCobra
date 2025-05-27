import React, { createRef, useState } from 'react';

import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';
import Record, { Round } from 'datatypes/Record';

import EditMatchRound from '../../records/EditMatchRound';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface EditRoundModalProps {
  record: Record;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  round: Round;
  roundIndex: number;
}

const EditRoundModal: React.FC<EditRoundModalProps> = ({ isOpen, setOpen, record, round, roundIndex }) => {
  const formRef = createRef<HTMLFormElement>();
  const [roundState, setRoundState] = useState<Round>(round);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} xl>
      <ModalHeader setOpen={setOpen}>{`Update match round for ${record.name}, Round ${roundIndex + 1}`}</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <EditMatchRound round={roundState} setRound={setRoundState} players={record.players} />
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block>
          Update Round
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/round/edit/${record.id}`}
          formData={{ round: JSON.stringify(roundState), roundIndex: `${roundIndex}` }}
          ref={formRef}
        ></CSRFForm>
      </ModalFooter>
    </Modal>
  );
};

export default EditRoundModal;
