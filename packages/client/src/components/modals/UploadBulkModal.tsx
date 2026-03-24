import React, { useEffect, useMemo, useState } from 'react';

import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Select from '../base/Select';
import Text from '../base/Text';
import CSRFForm from '../CSRFForm';

interface UploadBulkModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeID: string;
  boardOptions?: { value: string; label: string }[];
}

const UploadBulkModal: React.FC<UploadBulkModalProps> = ({ isOpen, setOpen, cubeID, boardOptions }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [targetBoard, setTargetBoard] = useState('mainboard');
  const formRef = React.createRef<HTMLFormElement>();

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
      board: targetBoard,
    }),
    [fileContent, targetBoard],
  );

  const defaultBoardOptions = [
    { value: 'mainboard', label: 'Mainboard' },
    { value: 'maybeboard', label: 'Maybeboard' },
  ];
  const options = boardOptions && boardOptions.length > 0 ? boardOptions : defaultBoardOptions;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <CSRFForm method="POST" action={`/cube/bulkuploadfile/${cubeID}`} ref={formRef} formData={formData}>
        <ModalHeader setOpen={setOpen}>Upload Bulk Add</ModalHeader>
        <ModalBody>
          <Text>Upload a CSV file to add cards to the cube.</Text>
          <Text sm className="mt-1 text-text-secondary">
            If the CSV has a &quot;board&quot; column, it will take precedence over the selection below.
          </Text>
          <Select
            label="Default Board"
            value={targetBoard}
            setValue={setTargetBoard}
            options={options}
            className="mt-2"
          />
          <Input type="file" name="file" accept=".csv" onChange={handleFileChange} className="mt-2" />
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" justify="between" gap="2" className="w-full">
            <Button color="primary" type="submit" disabled={!file} block>
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

export default UploadBulkModal;
