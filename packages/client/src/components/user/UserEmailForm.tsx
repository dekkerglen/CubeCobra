import React, { useMemo, useState } from 'react';

import Button from '../base/Button';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import CSRFForm from '../CSRFForm';

interface UserEmailFormProps {
  currentEmail?: string;
  /** A requested change still waiting for its confirmation link to be opened. */
  pendingEmail?: string;
}

const UserEmailForm: React.FC<UserEmailFormProps> = ({ currentEmail, pendingEmail }) => {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const formRef = React.useRef<HTMLFormElement>(null);
  const formData = useMemo(() => ({ email: newEmail, password }), [newEmail, password]);

  return (
    <CSRFForm method="POST" action="/user/updateemail" ref={formRef} formData={formData}>
      <Flexbox direction="col" gap="2">
        {currentEmail && (
          <div className="mb-3">
            <strong>Current email:</strong> {currentEmail}
          </div>
        )}
        {pendingEmail && (
          <Text sm className="text-text-secondary">
            We sent a confirmation link to <strong>{pendingEmail}</strong>. Your email address will change once you open
            it. Didn't get it? Check your spam folder or request the change again.
          </Text>
        )}
        <Text sm className="text-text-secondary">
          For your security, enter your current password. We'll email a confirmation link to the new address, and your
          email only changes once you open that link.
        </Text>
        <Input
          label="New email"
          id="email"
          name="email"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <Input
          label="Current password"
          id="emailPassword"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button block color="accent" disabled={!newEmail || !password} onClick={() => formRef.current?.submit()}>
          Send Confirmation Link
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default UserEmailForm;
