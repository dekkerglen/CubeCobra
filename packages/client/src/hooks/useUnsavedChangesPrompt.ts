import { useCallback, useEffect, useRef } from 'react';

// Has the browser confirm closing, reloading or navigating away from the page while `active`.
// Returns a function to call right before a deliberate navigation (a save submitting its form or
// redirecting once it lands) so that one goes through without the prompt.
const useUnsavedChangesPrompt = (active: boolean): (() => void) => {
  const leavingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [active]);

  return useCallback(() => {
    leavingRef.current = true;
  }, []);
};

export default useUnsavedChangesPrompt;
