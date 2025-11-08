import React, { useContext, useMemo, useState } from 'react';

import CubeContext from '../../contexts/CubeContext';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';
import TextArea from '../base/TextArea';
import CSRFForm from '../CSRFForm';

interface UploadDecklistModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const UploadDecklistModal: React.FC<UploadDecklistModalProps> = ({ isOpen, setOpen }) => {
  const { cube } = useContext(CubeContext);
  const [decklist, setDecklist] = useState<string>('');
  const formRef = React.createRef<HTMLFormElement>();
  const formData = useMemo(() => ({ body: decklist }), [decklist]);
  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <CSRFForm method="POST" action={`/cube/deck/uploaddecklist/${cube.id}`} formData={formData} ref={formRef}>
        <ModalHeader setOpen={setOpen}>
          <Text semibold lg>
            Upload Decklist
          </Text>
        </ModalHeader>
        <ModalBody>
          <Flexbox direction="col" gap="2">
            <Text>
              Acceptable formats are: one card name per line, or one card name per line prepended with #x, such as:
            </Text>
            <Text>&quot;2x island&quot;</Text>
            <TextArea
              label="Decklist"
              name="decklist"
              placeholder="Decklist"
              rows={10}
              value={decklist}
              onChange={(e) => setDecklist(e.target.value)}
            />
          </Flexbox>
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" gap="2" className="w-full">
            <Button block color="primary" onClick={() => formRef.current?.submit()}>
              Upload
            </Button>
            <Button block color="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </Flexbox>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default UploadDecklistModal;
