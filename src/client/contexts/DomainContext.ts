import { createContext } from 'react';

export interface DomainContextValue {
  value: boolean | string;
}

const DomainContext = createContext<DomainContextValue>({ value: false });

export default DomainContext;
