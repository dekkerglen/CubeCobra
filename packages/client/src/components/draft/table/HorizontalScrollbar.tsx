import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { motion, MotionValue, useMotionValue } from 'framer-motion';

interface HorizontalScrollbarProps {
  // The sideways scroll, and how far it goes.
  scroll: MotionValue<number>;
  max: number;
  // How much shows across, and how wide it all is.
  viewWidth: number;
  contentWidth: number;
  // Where the bar sits: stuck to the bottom of the screen, or placed on a stage.
  className: string;
  style?: React.CSSProperties;
}

const MIN_THUMB = 40;

/**
 * A scrollbar for something on a phone that scrolls sideways, where a swipe would
 * pick up a card instead (the deckbuilder, the draft's pool). Its thumb can be
 * dragged, and pressing the track brings the thumb there.
 */
const HorizontalScrollbar: React.FC<HorizontalScrollbarProps> = ({
  scroll,
  max,
  viewWidth,
  contentWidth,
  className,
  style,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const measure = () => setTrackWidth(track.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const thumbWidth = Math.min(trackWidth, Math.max(MIN_THUMB, (trackWidth * viewWidth) / Math.max(1, contentWidth)));
  const travel = trackWidth - thumbWidth;
  const thumbX = useMotionValue(0);
  useEffect(() => {
    const update = (value: number) => thumbX.set(max > 0 ? (value / max) * travel : 0);
    update(scroll.get());
    return scroll.on('change', update);
  }, [scroll, max, travel, thumbX]);

  // While held: the track's left on screen, and where on the thumb the pointer holds it.
  const hold = useRef<{ trackLeft: number; offset: number } | null>(null);
  const [held, setHeld] = useState(false);

  const scrollTo = (clientX: number) => {
    if (!hold.current || travel <= 0) return;
    const x = clientX - hold.current.trackLeft - hold.current.offset;
    scroll.stop();
    scroll.set(Math.max(0, Math.min(max, (x / travel) * max)));
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const trackLeft = trackRef.current?.getBoundingClientRect().left ?? 0;
    const x = event.clientX - trackLeft;
    const onThumb = x >= thumbX.get() && x <= thumbX.get() + thumbWidth;
    // The thumb stays where it was taken hold of; pressing the track centers it under the pointer.
    hold.current = { trackLeft, offset: onThumb ? x - thumbX.get() : thumbWidth / 2 };
    setHeld(true);
    if (!onThumb) scrollTo(event.clientX);
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
      onPointerMove={(event) => scrollTo(event.clientX)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div ref={trackRef} className="relative h-2 rounded-full bg-border/70">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full transition-colors ${
            held ? 'bg-text' : 'bg-text-secondary'
          }`}
          style={{ width: thumbWidth, x: thumbX }}
        />
      </div>
    </div>
  );
};

export default HorizontalScrollbar;
