import React, { useContext, useState } from 'react';

import { AlertIcon } from '@primer/octicons-react';

import ChangesContext from '../../contexts/ChangesContext';
import Alert from '../base/Alert';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Select from '../base/Select';
import Text from '../base/Text';
import TextArea from '../base/TextArea';
import CSRFForm from '../CSRFForm';

interface PasteBulkModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeID: string;
  boardOptions?: { value: string; label: string }[];
}

const PasteBulkModal: React.FC<PasteBulkModalProps> = ({ isOpen, setOpen, cubeID, boardOptions }) => {
  const [bulkText, setBulkText] = useState('');
  const [targetBoard, setTargetBoard] = useState('mainboard');
  const formRef = React.createRef<HTMLFormElement>();
  const formData = { body: bulkText, board: targetBoard };
  const { changes } = useContext(ChangesContext);

  const hasPendingChanges = Object.keys(changes)
    .filter((key) => key !== 'version')
    .some((board) => {
      const boardChanges = changes[board];
      if (!boardChanges || typeof boardChanges !== 'object') return false;
      return Object.values(boardChanges).some((c: any) => Array.isArray(c) && c.length > 0);
    });

  const defaultBoardOptions = [
    { value: 'mainboard', label: 'Mainboard' },
    { value: 'maybeboard', label: 'Maybeboard' },
  ];
  const options = boardOptions && boardOptions.length > 0 ? boardOptions : defaultBoardOptions;

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <CSRFForm method="POST" action={`/cube/bulkupload/${cubeID}`} ref={formRef} formData={formData}>
        <ModalHeader setOpen={setOpen}>Bulk Upload</ModalHeader>
        <ModalBody>
          {hasPendingChanges && (
            <Alert color="warning" className="mb-2">
              <Flexbox direction="row" gap="2" alignItems="center">
                <AlertIcon size={16} />
                <Text sm>
                  You have unsaved changes. Importing will merge into your current changelist. Consider saving your
                  pending changes first.
                </Text>
              </Flexbox>
            </Alert>
          )}
          <Text>Paste a list of card names to add to the cube, one per line.</Text>
          <Text sm className="mt-1 text-text-secondary">
            For CSV data with a &quot;board&quot; column, the board specified in the file takes precedence.
          </Text>
          <Select
            label="Default Board"
            value={targetBoard}
            setValue={setTargetBoard}
            options={options}
            className="mt-2"
          />
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
