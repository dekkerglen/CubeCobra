import React from 'react';

import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import LoginForm from '../forms/LoginForm';
import LoadingButton from '../LoadingButton';

interface LoginModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, setOpen }) => {
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <Modal sm isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>Login</ModalHeader>
      <ModalBody>
        <LoginForm formRef={formRef} />
      </ModalBody>
      <ModalFooter>
        <LoadingButton color="primary" outline block onClick={() => formRef.current?.submit()}>
          Login
        </LoadingButton>
      </ModalFooter>
    </Modal>
  );
};

export default LoginModal;
