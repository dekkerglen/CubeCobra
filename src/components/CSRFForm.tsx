import React, { ReactNode, forwardRef } from 'react';

import { getCsrfToken } from 'utils/CSRF';

interface CSRFFormProps {
  children: ReactNode;
  method: 'GET' | 'POST';
  action: string;
  formData: Record<string, string>;
  onSubmit?: () => void;
}

const CSRFForm = forwardRef<HTMLFormElement, CSRFFormProps>(({ children, method, action, formData, onSubmit }, ref) => {
  return (
    <form method={method} ref={ref} action={action} onSubmit={onSubmit}>
      <input type="hidden" name="_csrf" value={getCsrfToken() || ''} />
      {Object.entries(formData || {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {children}
    </form>
  );
});

export default CSRFForm;
