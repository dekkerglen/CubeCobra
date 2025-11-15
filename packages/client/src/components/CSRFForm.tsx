import React, { forwardRef, ReactNode, useContext } from 'react';

import { CSRFContext } from '../contexts/CSRFContext';

interface CSRFFormProps {
  children?: ReactNode;
  method: 'GET' | 'POST';
  action: string;
  formData: Record<string, string>;
}

const CSRFForm = forwardRef<HTMLFormElement, CSRFFormProps>(({ children, method, action, formData }, ref) => {
  const { csrfToken } = useContext(CSRFContext);

  return (
    <form method={method} ref={ref} action={action}>
      <input type="hidden" name="_csrf" value={csrfToken || ''} />
      <input type="hidden" name="nickname" value={'Your Nickname'} />
      {Object.entries(formData || {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {children || null}
    </form>
  );
});

CSRFForm.displayName = 'CSRFForm';

export default CSRFForm;
