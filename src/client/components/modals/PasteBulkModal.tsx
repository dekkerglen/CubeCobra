import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';
import TextArea from '../base/TextArea';
import CSRFForm from '../CSRFForm';
import React, { useState } from 'react';

interface PasteBulkModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeID: string;
}

const PasteBulkModal: React.FC<PasteBulkModalProps> = ({ isOpen, setOpen, cubeID }) => {
  const [bulkText, setBulkText] = useState('');
  const formRef = React.createRef<HTMLFormElement>();
  const formData = { body: bulkText };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <CSRFForm method="POST" action={`/cube/bulkupload/${cubeID}`} ref={formRef} formData={formData}>
        <ModalHeader setOpen={setOpen}>Bulk Upload</ModalHeader>
        <ModalBody>
          <Text>Paste a list of card names to add to the cube, one per line.</Text>
          <TextArea
            name="body"
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            rows={10}
            className="mt-2"
          />
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" justify="between" gap="2" className="w-full">
            <Button color="primary" disabled={!bulkText} block onClick={() => formRef.current?.submit()}>
              Add Cards
            </Button>
            <Button color="secondary" onClick={() => setOpen(false)} block>
              Close
            </Button>
          </Flexbox>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default PasteBulkModal;
