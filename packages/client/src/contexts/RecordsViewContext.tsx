import React, { ReactNode } from 'react';

import useQueryParam from '../hooks/useQueryParam';

interface RecordsViewContextValue {
  view: string;
  setView: (view: string) => void;
}

const RecordsViewContext = React.createContext<RecordsViewContextValue | null>(null);

export const RecordsViewContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useQueryParam('view', 'draft-reports');

  return <RecordsViewContext.Provider value={{ view, setView }}>{children}</RecordsViewContext.Provider>;
};

export default RecordsViewContext;
