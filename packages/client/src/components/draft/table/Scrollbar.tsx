import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { motion, MotionValue, useMotionValue } from 'framer-motion';

interface ScrollbarProps {
  // Sideways (x) or down (y).
  axis?: 'x' | 'y';
  // The scroll, and how far it goes.
  scroll: MotionValue<number>;
  max: number;
  // How much shows, and how much there is, along the axis.
  view: number;
  content: number;
  // Where the bar sits: stuck to the bottom of the screen, or placed on a stage.
  className: string;
  style?: React.CSSProperties;
}

const MIN_THUMB = 40;

/**
 * A scrollbar for something on a phone that scrolls where a swipe would pick up
 * a card instead (the deckbuilder, the draft's pack and pool). Its thumb can be
 * dragged, and pressing the track brings the thumb there.
 */
const Scrollbar: React.FC<ScrollbarProps> = ({ axis = 'x', scroll, max, view, content, className, style }) => {
  const across = axis === 'x';
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackLength, setTrackLength] = useState(0);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const measure = () => setTrackLength(across ? track.clientWidth : track.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [across]);

  const thumbLength = Math.min(trackLength, Math.max(MIN_THUMB, (trackLength * view) / Math.max(1, content)));
  const travel = trackLength - thumbLength;
  const thumbOffset = useMotionValue(0);
  useEffect(() => {
    const update = (value: number) => thumbOffset.set(max > 0 ? (value / max) * travel : 0);
    update(scroll.get());
    return scroll.on('change', update);
  }, [scroll, max, travel, thumbOffset]);

  // While held: the track's start on screen, and where on the thumb the pointer holds it.
  const hold = useRef<{ trackStart: number; offset: number } | null>(null);
  const [held, setHeld] = useState(false);
  const along = (event: React.PointerEvent) => (across ? event.clientX : event.clientY);

  const scrollTo = (position: number) => {
    if (!hold.current || travel <= 0) return;
    const at = position - hold.current.trackStart - hold.current.offset;
    scroll.stop();
    scroll.set(Math.max(0, Math.min(max, (at / travel) * max)));
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = trackRef.current?.getBoundingClientRect();
    const trackStart = (across ? rect?.left : rect?.top) ?? 0;
    const at = along(event) - trackStart;
    const onThumb = at >= thumbOffset.get() && at <= thumbOffset.get() + thumbLength;
    // The thumb stays where it was taken hold of; pressing the track centers it under the pointer.
    hold.current = { trackStart, offset: onThumb ? at - thumbOffset.get() : thumbLength / 2 };
    setHeld(true);
    if (!onThumb) scrollTo(along(event));
  };

  const release = () => {
    hold.current = null;
    setHeld(false);
  };

  return (
    // The whole bar takes hold of the pointer, so the thin track is easy to catch.
    <div
      className={className}
      style={{ ...style, touchAction: 'none' }}
      onPointerDown={pointerDown}
      onPointerMove={(event) => scrollTo(along(event))}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div ref={trackRef} className={`relative rounded-full bg-border/70 ${across ? 'h-2' : 'w-2 h-full'}`}>
        <motion.div
          className={`absolute left-0 top-0 rounded-full transition-colors ${held ? 'bg-text' : 'bg-text-secondary'} ${
            across ? 'inset-y-0' : 'inset-x-0'
          }`}
          style={across ? { width: thumbLength, x: thumbOffset } : { height: thumbLength, y: thumbOffset }}
        />
      </div>
    </div>
  );
};

export default Scrollbar;
