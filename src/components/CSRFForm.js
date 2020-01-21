import React, { forwardRef } from 'react';

import { Form, Input } from 'reactstrap';

import { getCsrfToken } from '../utils/CSRF';

const CSRFForm = forwardRef(({ children, ...props }, ref) => (
  <Form ref={ref} {...props}>
    <Input type="hidden" name="_csrf" value={getCsrfToken() || ''} />
    {children}
  </Form>
));

CSRFForm.propTypes = {};

export default CSRFForm;
