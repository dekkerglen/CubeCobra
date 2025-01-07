import React from 'react';
import CSRFForm from '../CSRFForm';
import Input from '../base/Input';
import { Flexbox } from '../base/Layout';
import Button from '../base/Button';

const LostPasswordForm: React.FC = () => {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [formData, setFormData] = React.useState<Record<string, string>>({
    email: '',
  });

  return (
    <CSRFForm ref={formRef} method="POST" action="/user/lostpassword" formData={formData}>
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
        <Button type="submit" color="primary" block onClick={() => formRef.current?.submit()}>
          Continue
        </Button>
      </Flexbox>
    </CSRFForm>
  );
};

export default LostPasswordForm;
