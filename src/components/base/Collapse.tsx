import React from 'react';

interface CollapseProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

const Collapse: React.FC<CollapseProps> = ({ isOpen, children, className }) => {
  return <div className={`overflow-hidden ${isOpen ? 'max-h-fit' : 'max-h-0'} ${className}`}>{children}</div>;
};

export default Collapse;
