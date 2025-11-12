import React, { createRef, useState } from 'react';

import Record from '@utils/datatypes/Record';

import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';

import EditTrophies from '../../records/EditTrophies';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface AssignTrophiesModalProps {
  record: Record;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const AssignTrophiesModal: React.FC<AssignTrophiesModalProps> = ({ isOpen, setOpen, record }) => {
  const formRef = createRef<HTMLFormElement>();

  //Player renames can cause divergence from trophy winner names, remove any trophy winners that aren't in the player list
  const playerNames = new Set(record.players.map((p) => p.name));
  const filteredTrophyNames = record.trophy.filter((name) => playerNames.has(name));
  const [trophyState, setTrophyState] = useState<Record['trophy']>(filteredTrophyNames || []);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} xl>
      <ModalHeader setOpen={setOpen}>{`Assign trophies for ${record.name}`}</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <EditTrophies record={record} trophies={trophyState} setTrophies={setTrophyState} />
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block>
          Update Results
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/trophy/${record.id}`}
          formData={{ trophy: JSON.stringify(trophyState) }}
          ref={formRef}
        ></CSRFForm>
      </ModalFooter>
    </Modal>
  );
};

export default AssignTrophiesModal;
