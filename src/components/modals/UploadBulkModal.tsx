import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import { Flexbox } from 'components/base/Layout';

interface UploadBulkModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  cubeID: string;
}

const UploadBulkModal: React.FC<UploadBulkModalProps> = ({ isOpen, setOpen, cubeID }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
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
    }),
    [fileContent],
  );

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
          <Input type="file" name="file" accept=".csv" onChange={handleFileChange} />
        </ModalBody>
        <ModalFooter>
          <Flexbox direction="row" justify="between" gap="2" className="w-full">
            <Button color="primary" type="submit" disabled={!file} block>
              Upload
            </Button>
            <Button color="danger" onClick={() => setOpen(false)} block>
              Close
            </Button>
          </Flexbox>
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default UploadBulkModal;
