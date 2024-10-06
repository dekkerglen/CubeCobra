import React from 'react';

interface CollapseProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

const Collapse: React.FC<CollapseProps> = ({ isOpen, children, className }) => {
  return (
    <div
      className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-fit' : 'max-h-0'} ${className}`}
    >
      {children}
    </div>
  );
};

export default Collapse;
