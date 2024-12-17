import React from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { PasteIcon } from '@primer/octicons-react';
import Text from 'components/base/Text';
import { Flexbox } from 'components/base/Layout';

interface CubeIdModalProps {
  setOpen: (open: boolean) => void;
  isOpen: boolean;
  shortId: string;
  fullID: string;
  alert: (type: string, message: string) => void;
}

const CubeIdModal: React.FC<CubeIdModalProps> = ({ setOpen, isOpen, shortId, fullID, alert }) => {
  const onCopyClick = async (id: string, label: string) => {
    await navigator.clipboard.writeText(id);
    alert('success', `${label} copied to clipboard`);
    setOpen(false);
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Cube ID</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Text semibold sm>
            Short ID
          </Text>
          <Flexbox direction="row" gap="2" className="mb-2">
            <Input className="monospaced" value={shortId} disabled onChange={() => {}} />
            <Button
              className="btn-sm input-group-button"
              onClick={() => onCopyClick(shortId, 'short ID')}
              aria-label="Copy short ID"
            >
              <PasteIcon size={16} />
            </Button>
          </Flexbox>
          <Text sm>A custom, memorable ID that owners are allowed to modify.</Text>
          <Text semibold sm>
            Full ID
          </Text>
          <Flexbox direction="row" gap="2" className="mb-2">
            <Input className="monospaced" value={fullID} disabled onChange={() => {}} />
            <Button
              className="btn-sm input-group-button"
              onClick={() => onCopyClick(fullID, 'Full ID')}
              aria-label="Copy Full ID"
            >
              <PasteIcon size={16} />
            </Button>
          </Flexbox>
          <Text sm>The canonical unique ID for this cube, guaranteed not to change.</Text>
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={() => setOpen(false)} block>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CubeIdModal;
