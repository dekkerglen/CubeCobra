import React, { createContext } from 'react';

interface DomainContextValue {
  value: boolean;
}

const DomainContext = createContext<DomainContextValue>({ value: false });

export default DomainContext;
