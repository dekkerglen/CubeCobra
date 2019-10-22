import React from 'react';

import { Form, Input } from 'reactstrap';

import { getCsrfToken } from '../util/CSRF';

const CSRFForm = ({ children, ...props }) =>
  <Form {...props}>
    <Input type="hidden" name="_csrf" value={getCsrfToken()} />
    {children}
  </Form>;

export default CSRFForm;