import React from 'react';

import Record from '@utils/datatypes/Record';

import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';

import EditDescription from '../../records/EditDescription';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';

interface EditRecordOverviewModalProps {
  record: Record;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const EditRecordOverviewModal: React.FC<EditRecordOverviewModalProps> = ({ isOpen, setOpen, record }) => {
  const [recordState, setRecord] = React.useState<Partial<Record>>(record);
  const formRef = React.createRef<HTMLFormElement>();

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} xl>
      <ModalHeader setOpen={setOpen}>{`Edit Record overview for ${record.name}`}</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <EditDescription value={recordState} setValue={setRecord} />
      </ModalBody>
      <ModalFooter>
        <LoadingButton onClick={() => formRef.current?.submit()} color="primary" block>
          Save
        </LoadingButton>
        <CSRFForm
          method="POST"
          action={`/cube/records/edit/overview/${record.id}`}
          formData={{ record: JSON.stringify(recordState) }}
          ref={formRef}
        ></CSRFForm>
      </ModalFooter>
    </Modal>
  );
};

export default EditRecordOverviewModal;
