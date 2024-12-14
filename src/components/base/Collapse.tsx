import React from 'react';

interface CollapseProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

const Collapse: React.FC<CollapseProps> = ({ isOpen, children, className }) => {
  return <div className={`${isOpen ? 'max-h-fit' : 'overflow-hidden max-h-0'} ${className}`}>{children}</div>;
};

export default Collapse;
