import React, { createRef, useState } from 'react';

import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';
import Record, { Round } from 'datatypes/Record';

import EditMatchRoundResults from '../../records/EditMatchRoundResults';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface EditMatchResultsModalProps {
  record: Record;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  round: Round;
  roundIndex: number;
}

const EditMatchResultsModal: React.FC<EditMatchResultsModalProps> = ({
  isOpen,
  setOpen,
  record,
  round,
  roundIndex,
}) => {
  const formRef = createRef<HTMLFormElement>();
  const [roundState, setRoundState] = useState<Round>(round);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} xl>
      <ModalHeader setOpen={setOpen}>{`Update match results for ${record.name}, Rond ${roundIndex + 1}`}</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <EditMatchRoundResults round={roundState} setRound={setRoundState} />
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block>
          Update Results
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

export default EditMatchResultsModal;
