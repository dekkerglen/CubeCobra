import React, { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

import { cardImageUrl } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';

interface DragGhostProps {
  card: Card;
  getPointer: () => { x: number; y: number };
}

const FULL_WIDTH = 170;
const TINY_WIDTH = 64;

// A copy of the dragged card that follows the cursor. It mounts at near-full
// size and eases down to a tiny card (the shrink animation), then trails the
// pointer. pointer-events:none so it never blocks drop hit-testing underneath.
const DragGhost: React.FC<DragGhostProps> = ({ card, getPointer }) => {
  const [pos, setPos] = useState(getPointer);
  const [shrunk, setShrunk] = useState(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    // Flip to the tiny size on the next frame so the width transition runs.
    const raf = requestAnimationFrame(() => setShrunk(true));
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-[1000] pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-[width] duration-200 ease-out drop-shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: shrunk ? TINY_WIDTH : FULL_WIDTH }}
    >
      <img
        src={cardImageUrl(card)}
        alt=""
        draggable={false}
        className="w-full select-none rounded-[4.75%] ring-2 ring-button-primary"
      />
    </div>,
    document.body,
  );
};

export default DragGhost;
