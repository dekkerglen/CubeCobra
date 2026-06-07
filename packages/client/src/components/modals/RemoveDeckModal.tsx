import React, { createRef } from 'react';

import Record from '@utils/datatypes/Record';

import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';

import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface RemoveDeckModalProps {
  record: Record;
  seatIndex: number;
  playerName: string;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const RemoveDeckModal: React.FC<RemoveDeckModalProps> = ({ isOpen, setOpen, record, seatIndex, playerName }) => {
  const formRef = createRef<HTMLFormElement>();

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>Remove Deck?</ModalHeader>
      <ModalBody>
        <Text>
          Are you sure you want to remove {playerName}&apos;s deck from this record? {playerName} will stay in the record
          (and keep their standings), but their decklist will be cleared. This cannot be undone.
        </Text>
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="danger" block>
          Remove Deck
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/deck/remove/${record.id}`}
          formData={{ seatIndex: `${seatIndex}` }}
          ref={formRef}
        ></CSRFForm>
      </ModalFooter>
    </Modal>
  );
};

export default RemoveDeckModal;
