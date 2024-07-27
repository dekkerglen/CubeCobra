import { createContext } from 'react';

interface AdsContextValue {
  value: boolean;
}

const AdsContext = createContext<AdsContextValue>({ value: false });

export default AdsContext;
