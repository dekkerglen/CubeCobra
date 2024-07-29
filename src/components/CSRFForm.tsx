import React, { forwardRef, ReactNode } from 'react';
import { Form, Input, FormProps } from 'reactstrap';
import { getCsrfToken } from 'utils/CSRF';

export interface CSRFFormProps extends FormProps {
  children: ReactNode;
}

const CSRFForm = forwardRef<HTMLFormElement, CSRFFormProps>(({ children, ...props }, ref) => (
  <Form ref={ref} {...props}>
    <Input type="hidden" name="_csrf" value={getCsrfToken() || ''} />
    {children}
  </Form>
));

export default CSRFForm;
