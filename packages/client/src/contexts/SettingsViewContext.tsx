import React, { ReactNode, useCallback, useContext, useEffect, useRef } from 'react';

import useQueryParam from '../hooks/useQueryParam';
import useUnsavedChangesPrompt from '../hooks/useUnsavedChangesPrompt';

interface SettingsViewContextValue {
  view: string;
  setView: (view: string) => void;
  setUnsavedChanges: (unsaved: boolean) => void;
}

const SettingsViewContext = React.createContext<SettingsViewContextValue | null>(null);

export const SettingsViewContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setQueryView] = useQueryParam('view', 'overview');
  // Whether the open section holds edits it hasn't saved. Switching sections unmounts it and
  // drops them, so a switch asks first while this is set.
  const unsavedRef = useRef(false);

  const setUnsavedChanges = useCallback((unsaved: boolean) => {
    unsavedRef.current = unsaved;
  }, []);

  const setView = useCallback(
    (next: string) => {
      if (unsavedRef.current && next !== view && !window.confirm('You have unsaved changes. Discard them?')) {
        return;
      }
      setQueryView(next);
    },
    [view, setQueryView],
  );

  return (
    <SettingsViewContext.Provider value={{ view, setView, setUnsavedChanges }}>{children}</SettingsViewContext.Provider>
  );
};

// For a settings section with a Save button: while it has unsaved changes, closing or leaving
// the page and switching to another section both ask first. Returns a function to call right
// before the save's own navigation so that one goes through without the prompt.
export const useSettingsUnsavedChanges = (hasChanges: boolean): (() => void) => {
  const context = useContext(SettingsViewContext);
  const setUnsavedChanges = context?.setUnsavedChanges;

  useEffect(() => {
    if (!setUnsavedChanges) {
      return undefined;
    }
    setUnsavedChanges(hasChanges);
    return () => setUnsavedChanges(false);
  }, [hasChanges, setUnsavedChanges]);

  return useUnsavedChangesPrompt(hasChanges);
};

export default SettingsViewContext;
