import React from 'react';
import CSRFForm from 'components/CSRFForm';
import Input from 'components/base/Input';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';

interface RegisterFormProps {
  email?: string;
  username?: string;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ email = '', username = '' }) => {
  const [formData, setFormData] = React.useState({
    email,
    username,
    password: '',
    password2: '',
  });
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <CSRFForm ref={formRef} method="POST" action="/user/register" formData={formData}>
      <Flexbox direction="col" gap="2">
        <Input
          label="Email Address"
          maxLength={1000}
          name="email"
          id="email"
          type="text"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <Input
          label="Username"
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
          Register
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default RegisterForm;
