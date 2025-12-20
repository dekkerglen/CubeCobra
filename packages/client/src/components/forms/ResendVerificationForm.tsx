import React from 'react';

import Button from '../base/Button';
import Input from '../base/Input';
import CSRFForm from '../CSRFForm';

interface ResendVerificationFormProps {
  formRef: React.RefObject<HTMLFormElement>;
  onCancel?: () => void;
}

const ResendVerificationForm: React.FC<ResendVerificationFormProps> = ({ formRef, onCancel }) => {
  const [formData, setFormData] = React.useState<Record<string, string>>({
    email: '',
  });

  return (
    <CSRFForm ref={formRef} method="POST" action="/user/resendverification" formData={formData}>
      <Input
        label="Email Address"
        maxLength={100}
        name="email"
        id="resend-email"
        type="email"
        placeholder="Enter your email address"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        onEnter={() => formRef.current?.submit()}
      />
      <div className="mt-3 flex gap-2">
        <Button type="submit" color="primary" onClick={() => formRef.current?.submit()}>
          Resend Verification Email
        </Button>
        {onCancel && (
          <Button type="button" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </CSRFForm>
  );
};

export default ResendVerificationForm;
