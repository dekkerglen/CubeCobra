import React from 'react';

import Record from '@utils/datatypes/Record';

import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';

import EditPlayerList from '../../records/EditPlayerList';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface EditPlayerListModalProps {
  record: Record;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const EditPlayerListModal: React.FC<EditPlayerListModalProps> = ({ isOpen, setOpen, record }) => {
  const [playerList, setPlayerList] = React.useState<Record['players']>(record.players);
  const formRef = React.createRef<HTMLFormElement>();

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} xl>
      <ModalHeader setOpen={setOpen}>{`Edit player list for ${record.name}`}</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <EditPlayerList players={playerList} setPlayers={setPlayerList} />
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block>
          Save
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/players/${record.id}`}
          formData={{ players: JSON.stringify(playerList) }}
          ref={formRef}
        ></CSRFForm>
      </ModalFooter>
    </Modal>
  );
};

export default EditPlayerListModal;
