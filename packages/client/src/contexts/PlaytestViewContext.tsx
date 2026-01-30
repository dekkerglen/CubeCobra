import React, { ReactNode } from 'react';

import useQueryParam from '../hooks/useQueryParam';

interface PlaytestViewContextValue {
  view: string;
  setView: (view: string) => void;
}

const PlaytestViewContext = React.createContext<PlaytestViewContextValue | null>(null);

export const PlaytestViewContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useQueryParam('view', 'sample-pack');

  return <PlaytestViewContext.Provider value={{ view, setView }}>{children}</PlaytestViewContext.Provider>;
};

export default PlaytestViewContext;
