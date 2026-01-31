import React, { ReactNode } from 'react';

import useQueryParam from '../hooks/useQueryParam';

interface AboutViewContextValue {
  view: string;
  setView: (view: string) => void;
}

const AboutViewContext = React.createContext<AboutViewContextValue | null>(null);

export const AboutViewContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useQueryParam('view', 'primer');

  return <AboutViewContext.Provider value={{ view, setView }}>{children}</AboutViewContext.Provider>;
};

export default AboutViewContext;
