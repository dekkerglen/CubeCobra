import React, { useEffect, useRef, useState } from 'react';

import { motion, MotionValue, useMotionValue } from 'framer-motion';

interface ScrollThumbProps {
  scroll: MotionValue<number>;
  max: number;
  // Track position and length, in stage pixels.
  left: number;
  top: number;
  height: number;
}

// The track is thin, so it takes hold of the pointer a little to either side of it.
const GRAB_MARGIN = 4;

/**
 * A thin scrollbar for a scrolling region of the stage: it shows where the
 * region is scrolled to, its thumb can be dragged, and pressing the track
 * brings the thumb there.
 */
const ScrollThumb: React.FC<ScrollThumbProps> = ({ scroll, max, left, top, height }) => {
  const thumbHeight = max > 0 ? Math.max(28, (height * height) / (height + max)) : 0;
  const thumbY = useMotionValue(0);
  useEffect(() => {
    if (max <= 0) return undefined;
    const update = (value: number) => thumbY.set((value / max) * (height - thumbHeight));
    update(scroll.get());
    return scroll.on('change', update);
  }, [scroll, max, height, thumbHeight, thumbY]);

  // While held: the track's top on screen, and where on the thumb the pointer holds it.
  const hold = useRef<{ trackTop: number; offset: number } | null>(null);
  const [held, setHeld] = useState(false);

  if (max <= 0) return null;
  const travel = height - thumbHeight;

  const scrollTo = (clientY: number) => {
    if (!hold.current || travel <= 0) return;
    const y = clientY - hold.current.trackTop - hold.current.offset;
    scroll.stop();
    scroll.set(Math.max(0, Math.min(max, (y / travel) * max)));
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const trackTop = event.currentTarget.getBoundingClientRect().top;
    const y = event.clientY - trackTop;
    const onThumb = y >= thumbY.get() && y <= thumbY.get() + thumbHeight;
    // The thumb stays where it was taken hold of; pressing the track centers it under the pointer.
    hold.current = { trackTop, offset: onThumb ? y - thumbY.get() : thumbHeight / 2 };
    setHeld(true);
    if (!onThumb) scrollTo(event.clientY);
  };

  const release = () => {
    hold.current = null;
    setHeld(false);
  };

  return (
    <div
      className="group absolute"
      style={{ left: left - GRAB_MARGIN, top, height, width: 6 + 2 * GRAB_MARGIN, zIndex: 2300, touchAction: 'none' }}
      onPointerDown={pointerDown}
      onPointerMove={(event) => scrollTo(event.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div className="absolute inset-y-0 rounded-full bg-border/70" style={{ left: GRAB_MARGIN, width: 6 }}>
        <motion.div
          className={`absolute inset-x-0 top-0 rounded-full transition-colors ${
            held ? 'bg-text-secondary' : 'bg-text-secondary/70 group-hover:bg-text-secondary'
          }`}
          style={{ height: thumbHeight, y: thumbY }}
        />
      </div>
    </div>
  );
};

export default ScrollThumb;
