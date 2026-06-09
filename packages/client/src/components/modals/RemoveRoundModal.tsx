import React, { createRef } from 'react';

import Record from '@utils/datatypes/Record';

import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';

import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface RemoveRoundModalProps {
  record: Record;
  roundIndex: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const RemoveRoundModal: React.FC<RemoveRoundModalProps> = ({ isOpen, setOpen, record, roundIndex }) => {
  const formRef = createRef<HTMLFormElement>();

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>{`Remove Round ${roundIndex + 1}?`}</ModalHeader>
      <ModalBody>
        <Text>
          Are you sure you want to remove Round {roundIndex + 1} from {record.name}? This will update the standings and
          cannot be undone.
        </Text>
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="danger" block>
          Remove Round
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/round/remove/${record.id}`}
          formData={{ roundIndex: `${roundIndex}` }}
          ref={formRef}
        ></CSRFForm>
      </ModalFooter>
    </Modal>
  );
};

export default RemoveRoundModal;
