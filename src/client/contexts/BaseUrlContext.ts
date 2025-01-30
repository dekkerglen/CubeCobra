import { createContext } from 'react';

export interface BaseUrlContextValue {
  value: boolean | string;
}

const BaseUrlContext = createContext<BaseUrlContextValue>({ value: false });

export default BaseUrlContext;
