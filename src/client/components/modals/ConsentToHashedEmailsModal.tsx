import React, { useCallback, useContext } from 'react';

import { Flexbox } from 'components/base/Layout';
import { CSRFContext } from 'contexts/CSRFContext';

import Button from '../base/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Text from '../base/Text';

interface ConsentToHashedEmailsModalProps {
  isOpen: boolean;
}

const ConsentToHashedEmailsModal: React.FC<ConsentToHashedEmailsModalProps> = ({ isOpen }) => {
  const [open, setOpen] = React.useState(isOpen);
  const { csrfFetch } = useContext(CSRFContext);

  const handleResponse = useCallback(
    async (preference: boolean) => {
      await csrfFetch('/user/consentHashedEmails', {
        method: 'POST',
        body: JSON.stringify({ preference }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      setOpen(false);
    },
    [csrfFetch],
  );

  return (
    <Modal isOpen={open} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>Do you consent to providing our Advertising Partner a hashed email?</ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <Text>
          Consenting does not cause any personal information, including your email, to be shared or stored anywhere.
          This will only provide an anonymized token to our advertising partner to improve ad relevancy.
        </Text>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" gap="2" className="w-full">
          <Button color="primary" onClick={() => handleResponse(true)} block>
            I consent
          </Button>
          <Button color="danger" onClick={() => handleResponse(false)} block>
            I do not consent
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default ConsentToHashedEmailsModal;
