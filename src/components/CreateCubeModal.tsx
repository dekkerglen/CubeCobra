import React, { useMemo, useState } from 'react';

import { Modal, ModalHeader, ModalBody, ModalFooter } from 'components/base/Modal';
import Spinner from 'components/base/Spinner';
import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Col, Row } from 'components/base/Layout';

import CSRFForm from 'components/CSRFForm';

type Props = {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const CreateCubeModal: React.FC<Props> = ({ isOpen, setOpen }) => {
  const [loading, setLoading] = useState(false);
  const formRef = React.createRef<HTMLFormElement>();
  const [name, setName] = useState("");

  const formData = useMemo(() => ({ name }), [name]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>Create New Cube</ModalHeader>
      <CSRFForm ref={formRef} method="POST" action="/cube/add" formData={formData} onSubmit={() => setLoading(true)}>
        <ModalBody>
          <Row>
            <Col>
              <Input label="Cube name:" value={name}
                onChange={(e) => setName(e.target.value)} maxLength={1000} name="name" type="text" />
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          {loading ? (
            <div className="text-center min-w-full">
              <Spinner />
            </div>
          ) : (
            <Button type="submit" block color="primary" onClick={() => formRef.current?.submit()}>
              Create
            </Button>
          )}
        </ModalFooter>
      </CSRFForm>
    </Modal >
  );
};

export default CreateCubeModal;
