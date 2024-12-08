import React, { forwardRef, ReactNode } from 'react';
import { Form, FormProps, Input } from 'reactstrap';
import ReCAPTCHA from 'react-google-recaptcha';

import { getCsrfToken } from 'utils/CSRF';

export interface CSRFFormProps extends FormProps {
  children: ReactNode;
  action: string;
  method: 'GET' | 'POST';
}

const CSRFForm: React.FC<CSRFFormProps> = forwardRef<Form, CSRFFormProps>(({ children }, ref) => {
  const recaptchaRef = React.useRef<ReCAPTCHA>(null);

  const onSubmitWithReCAPTCHA = async (e: React.FormEvent<HTMLFormElement>) => {
    if (recaptchaRef) {
      const token = await recaptchaRef.current?.executeAsync();

      console.log('token', token);

      // apply to form data
      const formData = new FormData(e.target as HTMLFormElement);
      formData.append('g-recaptcha-response', token || '');
    }
  };

  return (
    <Form ref={ref} onSubmit={onSubmitWithReCAPTCHA}>
      <Input type="hidden" name="_csrf" value={getCsrfToken() || ''} />
      <ReCAPTCHA ref={recaptchaRef} size="invisible" sitekey="6LezKpUqAAAAABNZUVGgIwkg3tf3ZYFM9l1MqVAj" />
      {children}
    </Form>
  );
});

CSRFForm.displayName = 'CSRFForm';

export default CSRFForm;
