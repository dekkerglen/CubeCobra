import React, { ReactNode } from 'react';

import useQueryParam from '../hooks/useQueryParam';

interface AnalysisViewContextValue {
  view: string;
  setView: (view: string) => void;
}

const AnalysisViewContext = React.createContext<AnalysisViewContextValue | null>(null);

export const AnalysisViewContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useQueryParam('view', 'averages');

  return <AnalysisViewContext.Provider value={{ view, setView }}>{children}</AnalysisViewContext.Provider>;
};

export default AnalysisViewContext;
