import React from 'react';

import { Form, Input } from 'reactstrap';

const getToken = () => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : null;
}

export const csrfFetch = (resource, init) => {
  init.credentials = init.credentials || 'same-origin';
  init.headers = {
    ...init.headers,
    'CSRF-Token': getToken(),
  }
  return fetch(resource, init);
}

export const CSRFForm = ({ children, ...props }) =>
  <Form {...props}>
    <Input type="hidden" name="_csrf" value={getToken()} />
    {children}
  </Form>;

export default { csrfFetch };