import { useCallback, useContext, useState } from 'react';

import { CSRFContext } from 'contexts/CSRFContext';

export const PIN_LABEL = 'Pin to your menu (only you see this)';
export const UNPIN_LABEL = 'Unpin from your menu';

export interface PinToggle {
  pinned: boolean;
  // For callers that learn the initial state after mount (CubeHero's `ispinned` fallback).
  setPinned: (pinned: boolean) => void;
  toggle: () => void;
  label: string;
}

// Optimistic: flips immediately and reverts if the request fails.
export default function usePinToggle(cubeId: string, initial: boolean): PinToggle {
  const { csrfFetch } = useContext(CSRFContext);
  const [pinned, setPinned] = useState(initial);

  const toggle = useCallback(() => {
    const next = !pinned;
    setPinned(next);
    const revert = (reason: unknown) => {
      console.error(reason);
      setPinned(!next);
    };
    csrfFetch(`/cube/${next ? 'pin' : 'unpin'}/${cubeId}`, { method: 'POST', headers: {} })
      .then((response) => {
        if (!response.ok) revert(response);
      })
      .catch(revert);
  }, [csrfFetch, cubeId, pinned]);

  return { pinned, setPinned, toggle, label: pinned ? UNPIN_LABEL : PIN_LABEL };
}
