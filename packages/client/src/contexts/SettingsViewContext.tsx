import React, { ReactNode } from 'react';

import useQueryParam from '../hooks/useQueryParam';

interface SettingsViewContextValue {
  view: string;
  setView: (view: string) => void;
}

const SettingsViewContext = React.createContext<SettingsViewContextValue | null>(null);

export const SettingsViewContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useQueryParam('view', 'overview');

  return <SettingsViewContext.Provider value={{ view, setView }}>{children}</SettingsViewContext.Provider>;
};

export default SettingsViewContext;
