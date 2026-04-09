import React, { useContext, useEffect, useMemo, useState } from 'react';

import { AlertIcon } from '@primer/octicons-react';

import ChangesContext from '../../contexts/ChangesContext';
import Alert from '../base/Alert';
import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';
import CSRFForm from '../CSRFForm';

interface UploadBulkReplaceModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeID: string;
}

const UploadBulkReplaceModal: React.FC<UploadBulkReplaceModalProps> = ({ isOpen, setOpen, cubeID }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const formRef = React.createRef<HTMLFormElement>();
  const { changes } = useContext(ChangesContext);

  const hasPendingChanges = Object.keys(changes)
    .filter((key) => key !== 'version')
    .some((board) => {
      const boardChanges = changes[board];
      if (!boardChanges || typeof boardChanges !== 'object') return false;
      return Object.values(boardChanges).some((c: any) => Array.isArray(c) && c.length > 0);
    });

  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFileContent(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [file]);

  const formData = useMemo(
    () => ({
      file: fileContent,
    }),
    [fileContent],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <CSRFForm method="POST" action={`/cube/bulkreplacefile/${cubeID}`} ref={formRef} formData={formData}>
        <ModalHeader setOpen={setOpen}>Upload Bulk Replace</ModalHeader>
        <ModalBody>
          {hasPendingChanges && (
            <Alert color="warning" className="mb-2">
              <Flexbox direction="row" gap="2" alignItems="center">
                <AlertIcon size={16} />
                <Text sm>
                  You have unsaved changes. Replacing will discard your current changelist. Consider saving your pending
                  changes first.
                </Text>
              </Flexbox>
            </Alert>
          )}
          <Text>Upload a CSV file to replace the current cube list.</Text>
          <Input type="file" name="file" accept=".csv" onChange={handleFileChange} />
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" justify="between" gap="2" className="w-full">
            <Button color="primary" type="submit" disabled={!file} block onClick={() => formRef.current?.submit()}>
              Upload
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

export default UploadBulkReplaceModal;
