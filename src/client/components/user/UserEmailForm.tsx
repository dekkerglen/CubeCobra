import React, { useMemo, useState } from 'react';
import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import CSRFForm from '../CSRFForm';

const UserEmailForm: React.FC = ({}) => {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const formRef = React.useRef<HTMLFormElement>(null);
  const formData = useMemo(() => ({ email: newEmail, password }), [newEmail, password]);

  return (
    <CSRFForm method="POST" action="/user/updateemail" ref={formRef} formData={formData}>
      <Flexbox direction="col" gap="2">
        <Input
          label="New email"
          id="email"
          name="email"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <Input
          label="Password"
          id="emailPassword"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button block color="accent" onClick={() => formRef.current?.submit()}>
          Update
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default UserEmailForm;
