import React from 'react';

interface CollapseProps {
  isOpen: boolean;
  children: React.ReactNode;
}

const Collapse: React.FC<CollapseProps> = ({ isOpen, children }) => {
  return (
    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-fit' : 'max-h-0'}`}>
      {children}
    </div>
  );
};

export default Collapse;
