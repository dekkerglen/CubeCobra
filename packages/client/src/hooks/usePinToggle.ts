import { useCallback, useContext, useRef, useState } from 'react';

import { CSRFContext } from 'contexts/CSRFContext';

export const PIN_LABEL = 'Pin to your menu (only you see this)';
export const UNPIN_LABEL = 'Unpin from your menu';

export interface PinToggle {
  pinned: boolean;
  // For callers that learn the initial state after mount (CubeHero's `ispinned` fallback).
  setPinned: (pinned: boolean) => void;
  // No-op while `busy`, so a double click can't race two requests.
  toggle: () => void;
  busy: boolean;
  label: string;
}

// Optimistic: flips immediately and reverts if the request fails.
export default function usePinToggle(cubeId: string, initial: boolean): PinToggle {
  const { csrfFetch } = useContext(CSRFContext);
  const [pinned, setPinned] = useState(initial);
  const [busy, setBusy] = useState(false);
  // A ref as well as state, so two clicks in the same render can't both get through.
  const inFlight = useRef(false);

  const toggle = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
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
      .catch(revert)
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  }, [csrfFetch, cubeId, pinned]);

  return { pinned, setPinned, toggle, busy, label: pinned ? UNPIN_LABEL : PIN_LABEL };
}
