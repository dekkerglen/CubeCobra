import React from 'react';
import CSRFForm from 'components/CSRFForm';
import Input from 'components/base/Input';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';

interface LoginModalProps {
  code: string;
}

const PasswordResetForm: React.FC<LoginModalProps> = ({ code }) => {
  const [formData, setFormData] = React.useState<Record<string, string>>({
    username: '',
    password: '',
    password2: '',
    code: code,
  });
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <CSRFForm ref={formRef} method="POST" action="/user/login" formData={formData}>
      <Flexbox direction="col" gap="2">
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
        <Input
          label="Confirm Password"
          maxLength={1000}
          name="password2"
          id="password2"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        />
        <Button color="primary" block onClick={() => formRef.current?.submit()}>
          Change Password
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default PasswordResetForm;
