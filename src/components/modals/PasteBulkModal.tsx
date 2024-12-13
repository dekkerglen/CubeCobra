import Button from 'components/base/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';
import CSRFForm from 'components/CSRFForm';
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
    <Modal isOpen={isOpen} setOpen={setOpen}>
      <CSRFForm method="POST" action={`/cube/bulkadd/${cubeID}`} ref={formRef} formData={formData}>
        <ModalHeader setOpen={setOpen}>Paste Bulk Add</ModalHeader>
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
          <Button color="accent" type="submit" disabled={!bulkText}>
            Add Cards
          </Button>
          <Button color="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default PasteBulkModal;
