import React, { forwardRef, ReactNode } from 'react';

interface FormProps {
  children: ReactNode;
  method: 'GET' | 'POST';
  action?: string;
  formData?: Record<string, string>;
}

const Form = forwardRef<HTMLFormElement, FormProps>(({ children, method, action, formData }, ref) => {
  return (
    <form method={method} ref={ref} action={action}>
      {Object.entries(formData || {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {children}
    </form>
  );
});

export default Form;
