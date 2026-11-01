import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { animate, AnimationOptions, AnimationPlaybackControls, DOMKeyframesDefinition, motion } from 'framer-motion';

interface BoosterPackProps {
  // Center of the pack, in stage pixels.
  x: number;
  y: number;
  width: number;
  height: number;
  art?: string;
  name: string;
  label?: string;
  cardCount: number;
  // The pack has burst open; the cards inside should fly out now.
  onBurst: () => void;
  onDone: () => void;
}

/**
 * The sealed pack shown when a new pack is opened: it eases in, swells and
 * shakes while a foil sheen sweeps across it, then bursts open with a flash.
 *
 * The phases run as one awaited sequence on the pack's own animation clock, and
 * the burst is signalled from inside it, so the cards always leave the pack
 * exactly when it opens however busy the page is. Covers the stage while it
 * plays, so nothing can be grabbed before the cards have landed.
 */
const BoosterPack: React.FC<BoosterPackProps> = ({
  x,
  y,
  width,
  height,
  art,
  name,
  label,
  cardCount,
  onBurst,
  onDone,
}) => {
  const packRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const [burst, setBurst] = useState(false);

  // The sequence runs once; it reads the latest callbacks without restarting.
  const callbacks = useRef({ onBurst, onDone });
  useLayoutEffect(() => {
    callbacks.current = { onBurst, onDone };
  });

  useEffect(() => {
    const pack = packRef.current;
    const sheen = sheenRef.current;
    if (!pack || !sheen) return undefined;
    let cancelled = false;
    const running: AnimationPlaybackControls[] = [];
    const play = (element: Element, keyframes: DOMKeyframesDefinition, options: AnimationOptions) => {
      const controls = animate(element, keyframes, options);
      running.push(controls);
      return controls.finished;
    };

    (async () => {
      // Ease in from below.
      await play(
        pack,
        { y: [140, 0], scale: [0.5, 1], rotate: [-10, 0], opacity: [0, 1] },
        { duration: 0.42, ease: 'easeOut' },
      );
      if (cancelled) return;
      // Swell and shake while the sheen sweeps across.
      play(sheen, { x: ['-120%', '260%'] }, { duration: 0.7, ease: 'easeInOut' });
      await play(
        pack,
        { scale: [1, 1.03, 1.06, 1.08, 1.1, 1.12, 1.12], rotate: [0, -2, 2.5, -3, 3.5, -2, 0] },
        { duration: 0.73, ease: 'easeInOut' },
      );
      if (cancelled) return;
      // Burst: the cards fly out as the wrapper blows away.
      setBurst(true);
      callbacks.current.onBurst();
      await play(pack, { scale: 1.45, opacity: 0 }, { duration: 0.25, ease: 'easeOut' });
      if (cancelled) return;
      callbacks.current.onDone();
    })();

    return () => {
      cancelled = true;
      running.forEach((controls) => controls.stop());
    };
  }, []);

  const background = art
    ? { backgroundImage: `url("${art}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundImage: 'linear-gradient(135deg, #3b2f6b, #1d4f6e 55%, #2b6b4a)' };
  const crimp = {
    backgroundImage:
      'repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 2px, rgba(255,255,255,0.12) 2px 5px, rgba(0,0,0,0.35) 5px 7px)',
  };

  return (
    <div className="absolute inset-0" style={{ zIndex: 4000 }}>
      {burst && (
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: x - width,
            top: y - width,
            width: width * 2,
            height: width * 2,
            background:
              'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,236,170,0.55) 35%, transparent 70%)',
          }}
          initial={{ scale: 0.3, opacity: 1 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}

      {/* Starts hidden; the sequence above drives its transform and opacity. */}
      <div
        ref={packRef}
        className="absolute"
        style={{
          left: x - width / 2,
          top: y - height / 2,
          width,
          height,
          opacity: 0,
          transform: 'translateY(140px) scale(0.5) rotate(-10deg)',
        }}
      >
        <div
          className="relative w-full h-full rounded-[10px] overflow-hidden ring-1 ring-white/30 shadow-[0_30px_60px_-18px_rgba(0,0,0,0.95)]"
          style={background}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/5 to-black/75" />
          <div className="absolute inset-x-0 top-0 h-[5%]" style={crimp} />
          <div className="absolute inset-x-0 bottom-0 h-[5%]" style={crimp} />

          <div className="absolute inset-x-0 top-[12%] px-3 text-center">
            <div
              className="font-extrabold uppercase leading-tight text-white break-words"
              style={{
                fontSize: Math.max(13, width * 0.105),
                textShadow: '0 2px 0 rgba(0,0,0,0.55), 0 0 18px rgba(0,0,0,0.6)',
              }}
            >
              {name}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-[9%] flex flex-col items-center gap-0.5 text-white">
            {label && (
              <span
                className="px-2 py-0.5 rounded-full bg-black/55 font-semibold tracking-wide"
                style={{ fontSize: Math.max(10, width * 0.065) }}
              >
                {label}
              </span>
            )}
            <span className="opacity-80" style={{ fontSize: Math.max(9, width * 0.055) }}>
              {cardCount} cards
            </span>
          </div>

          {/* Foil sheen, swept across while the pack charges up */}
          <div
            ref={sheenRef}
            className="absolute inset-y-0 w-[45%] pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
              mixBlendMode: 'overlay',
              transform: 'translateX(-120%)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default BoosterPack;
