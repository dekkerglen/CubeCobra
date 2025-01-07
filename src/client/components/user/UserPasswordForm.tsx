import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import CSRFForm from '../CSRFForm';
import React, { useMemo, useState } from 'react';

const UserPasswordForm: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const formRef = React.useRef<HTMLFormElement>(null);
  const formData = useMemo(
    () => ({
      password: currentPassword,
      password2: newPassword,
      password3: confirmPassword,
    }),
    [currentPassword, newPassword, confirmPassword],
  );

  return (
    <CSRFForm method="POST" action="/user/resetpassword" ref={formRef} formData={formData}>
      <Flexbox direction="col" gap="2">
        <Input
          label="Old password"
          id="currentPassword"
          name="password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          label="New password"
          id="newPassword"
          name="password2"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          label="Confirm new password"
          id="confirmPassword"
          name="password3"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button block color="accent" onClick={() => formRef.current?.submit()}>
          Change Password
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default UserPasswordForm;
