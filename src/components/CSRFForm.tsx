import React, { forwardRef, ReactNode } from 'react';
import { Form, FormProps, Input } from 'reactstrap';

import { getCsrfToken } from 'utils/CSRF';

export interface CSRFFormProps extends FormProps {
  children: ReactNode;
}

const CSRFForm: React.FC<CSRFFormProps> = forwardRef<Form, CSRFFormProps>(({ children, ...props }, ref) => (
  <Form ref={ref} {...props}>
    <Input type="hidden" name="_csrf" value={getCsrfToken() || ''} />
    {children}
  </Form>
));

CSRFForm.displayName = 'CSRFForm';

export default CSRFForm;
