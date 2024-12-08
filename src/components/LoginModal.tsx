import React from 'react';
import CSRFForm from 'components/CSRFForm';
import Input from 'components/base/Input';

import { Modal, ModalHeader, ModalBody, ModalFooter } from 'components/base/Modal';
import LoadingButton from './LoadingButton';

interface LoginModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  loginCallback: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, setOpen, loginCallback }) => {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [formData, setFormData] = React.useState<Record<string, string>>({
    username: '',
    password: '',
    loginCallback: loginCallback,
  });

  return (
    <Modal sm isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>Login</ModalHeader>
      <ModalBody>
        <CSRFForm ref={formRef} method="POST" action="/user/login" formData={formData}>
          <Input
            label="Username or Email Address"
            maxLength={1000}
            name="username"
            id="username"
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />
          <Input
            label="Password"
            maxLength={1000}
            name="password"
            id="password"
            type="password"
            link={{ href: '/user/lostpassword', text: 'Forgot Password?' }}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
        </CSRFForm>
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
