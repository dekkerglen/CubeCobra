import React, { useCallback, useContext } from 'react';

import Card from '@utils/datatypes/Card';

import { useCubeTray } from '../../contexts/CubeTrayContext';
import UserContext from '../../contexts/UserContext';

// Shared drag-source logic for the cube tray. A card becomes draggable onto the
// tray when there's an enclosing CubeTrayProvider and a logged-in user. Each
// call site spreads these onto whatever element represents the card (a grid
// cell, a table row, a list item) — the element-specific event types stay at the
// call site via inline handlers.
export const useCubeTrayDrag = (enabled = true) => {
  const tray = useCubeTray();
  const user = useContext(UserContext);
  const active = enabled && !!tray && !!user;

  const start = useCallback(
    (card: Card, e: React.PointerEvent) => {
      if (active && tray) tray.startCardDrag(card, e);
    },
    [active, tray],
  );

  // Returns true if the click following a drag should be swallowed (so it
  // doesn't navigate / open a modal). Call from onClick / onClickCapture.
  const suppressClick = useCallback(() => (active && tray ? tray.consumeClickSuppression() : false), [active, tray]);

  return { active, start, suppressClick };
};

export default useCubeTrayDrag;
