import React from 'react';

import { Modal, ModalHeader, ModalBody, ModalFooter } from 'components/base/Modal';
import LoadingButton from '../LoadingButton';
import LoginForm from '../forms/LoginForm';

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
