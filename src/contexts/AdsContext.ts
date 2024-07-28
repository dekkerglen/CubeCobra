import { createContext } from 'react';

export interface AdsContextValue {
  value: boolean;
}

const AdsContext = createContext<AdsContextValue>({ value: false });

export default AdsContext;
