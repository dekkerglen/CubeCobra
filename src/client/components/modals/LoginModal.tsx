import React from 'react';

import { Modal, ModalBody, ModalFooter,ModalHeader } from '../base/Modal';
import LoginForm from '../forms/LoginForm';
import LoadingButton from '../LoadingButton';

interface LoginModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  loginCallback: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, setOpen, loginCallback }) => {
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <Modal sm isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>Login</ModalHeader>
      <ModalBody>
        <LoginForm loginCallback={loginCallback} formRef={formRef} />
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
