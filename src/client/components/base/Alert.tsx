import React, { useState } from 'react';

import { XIcon } from '@primer/octicons-react';
import classNames from 'classnames';

export interface AlertProps {
  color: string;
  children: React.ReactNode;
  className?: string;
}

//Foo
export interface UncontrolledAlertProps {
  color: 'danger' | 'warning' | 'success' | 'info';
  message: string;
}

const Alert: React.FC<AlertProps> = ({ color, children, className = '' }) => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className={`relative ${className} mt-3`}>
      <div
        className={classNames(`p-4 rounded-md`, {
          'bg-green-100 text-green-800': color === 'success',
          'bg-red-100 text-red-800': color === 'danger',
          'bg-yellow-100 text-yellow-800': color === 'warning',
          'bg-blue-100 text-blue-800': color === 'info',
        })}
      >
        {children}
        <button
          type="button"
          className="absolute top-0 right-0 mt-2 mr-2 text-lg font-bold"
          onClick={() => setVisible(false)}
        >
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
};

export default Alert;
