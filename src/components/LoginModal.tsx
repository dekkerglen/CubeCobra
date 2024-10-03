import React from 'react';
import CSRFForm from 'components/CSRFForm';
import Input from 'components/base/Input';
import Button from 'components/base/Button';

import { Modal, ModalHeader, ModalBody, ModalFooter } from 'components/base/Modal';
import { Flexbox } from './base/Layout';

interface LoginModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  loginCallback: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, setOpen, loginCallback }) => (
  <Modal lg isOpen={isOpen} setOpen={setOpen}>
    <ModalHeader setOpen={setOpen}>Login</ModalHeader>
    <CSRFForm method="POST" action="/user/login">
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Input label="Username or Email Address" maxLength={1000} name="username" id="email" type="text" />
          <Input
            label="Password"
            maxLength={1000}
            name="password"
            id="password"
            type="password"
            link={{ href: '/user/lostpassword', text: 'Forgot Password?' }}
          />
        </Flexbox>
        <Input type="hidden" name="loginCallback" value={loginCallback} />
      </ModalBody>
      <ModalFooter>
        <Button type="submit" color="success" block outline>
          Login
        </Button>
      </ModalFooter>
    </CSRFForm>
  </Modal>
);

export default LoginModal;
