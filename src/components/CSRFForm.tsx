import React, { ReactNode, forwardRef } from 'react';

import { getCsrfToken } from 'utils/CSRF';

interface CSRFFormProps {
  children: ReactNode;
  method: 'GET' | 'POST';
  action: string;
  formData: Record<string, string>;
}

const CSRFForm = forwardRef<HTMLFormElement, CSRFFormProps>(({ children, method, action, formData }, ref) => {
  return (
    <form method={method} ref={ref} action={action}>
      <input type="hidden" name="_csrf" value={getCsrfToken() || ''} />
      <input type="hidden" name="nickname" value={'Your Nickname'} />
      {Object.entries(formData || {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {children}
    </form>
  );
});

export default CSRFForm;
