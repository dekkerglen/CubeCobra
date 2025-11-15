import React from 'react';

import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import CSRFForm from '../CSRFForm';

interface LoginModalProps {
  code: string;
}

const PasswordResetForm: React.FC<LoginModalProps> = ({ code }) => {
  const [formData, setFormData] = React.useState<Record<string, string>>({
    email: '',
    password: '',
    password2: '',
    code: code,
  });
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <CSRFForm ref={formRef} method="POST" action="/user/lostpasswordreset" formData={formData}>
      <Flexbox direction="col" gap="2">
        <Input
          label="Username or Email Address"
          maxLength={1000}
          name="email"
          id="email"
          type="text"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
        <Input
          label="Confirm Password"
          maxLength={1000}
          name="password2"
          id="password2"
          type="password"
          value={formData.password2}
          onChange={(e) => setFormData({ ...formData, password2: e.target.value })}
        />
        <Button color="primary" block onClick={() => formRef.current?.submit()}>
          Change Password
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default PasswordResetForm;
