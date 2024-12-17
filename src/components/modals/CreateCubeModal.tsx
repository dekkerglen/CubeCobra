import React, { useContext, useMemo, useState } from 'react';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Spinner from 'components/base/Spinner';
import CaptchaContext from 'contexts/CaptchaContext';
import ReCAPTCHA from 'react-google-recaptcha';

import CSRFForm from 'components/CSRFForm';

type Props = {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
};

const CreateCubeModal: React.FC<Props> = ({ isOpen, setOpen }) => {
  const captchaSiteKey = useContext(CaptchaContext);
  const [loading, setLoading] = useState(false);
  const formRef = React.createRef<HTMLFormElement>();
  const [name, setName] = useState('');
  const [captcha, setCaptcha] = useState('');

  const formData = useMemo(() => ({ name, captcha }), [name, captcha]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>Create New Cube</ModalHeader>
      <CSRFForm ref={formRef} method="POST" action="/cube/add" formData={formData}>
        <ModalBody>
          <Flexbox direction="col" gap="2">
            <Input
              label="Cube name:"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={1000}
              name="name"
              type="text"
            />
            <ReCAPTCHA sitekey={captchaSiteKey} onChange={(value) => setCaptcha(value || '')} />
          </Flexbox>
        </ModalBody>
        <ModalFooter>
          {loading ? (
            <div className="text-center min-w-full">
              <Spinner />
            </div>
          ) : (
            <Button
              type="submit"
              block
              color="primary"
              onClick={() => {
                setLoading(true);
                formRef.current?.submit();
              }}
            >
              Create
            </Button>
          )}
        </ModalFooter>
      </CSRFForm>
    </Modal>
  );
};

export default CreateCubeModal;
