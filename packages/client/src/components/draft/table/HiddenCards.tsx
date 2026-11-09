import React, { useEffect, useState } from 'react';

import { ChevronDownIcon, ChevronUpIcon } from '@primer/octicons-react';
import { animate, AnimatePresence, motion, MotionValue } from 'framer-motion';

interface HiddenCardsProps {
  // The pack's scroll, and how far it goes.
  scroll: MotionValue<number>;
  max: number;
  // How much of the pack shows, and where its cards' tops are in its scrolled content.
  view: number;
  tops: number[];
  cardHeight: number;
  // Room kept clear above the count of cards above (the pack's tag).
  topInset?: number;
  className: string;
  style?: React.CSSProperties;
}

// px between the counts and the edges, and between cards brought into view and the edge.
const MARGIN = 4;

const PILL =
  'absolute left-1/2 pointer-events-auto flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-black/75 text-white text-xxs font-semibold shadow-lg';

// A card is out of view when its middle is.
const outOfView = (tops: number[], cardHeight: number, view: number, at: number) => ({
  above: tops.filter((top) => top + cardHeight / 2 < at),
  below: tops.filter((top) => top + cardHeight / 2 > at + view),
});

/**
 * How many of a phone's pack cards are scrolled out of view, at the edge they're
 * past, for when a pinch has made the pack too big to fit. Pressing a count
 * scrolls a page that way, the nearest of those cards first.
 */
const HiddenCards: React.FC<HiddenCardsProps> = ({
  scroll,
  max,
  view,
  tops,
  cardHeight,
  topInset = 0,
  className,
  style,
}) => {
  const [counts, setCounts] = useState({ above: 0, below: 0 });
  useEffect(() => {
    const update = (at: number) => {
      const { above, below } = outOfView(tops, cardHeight, view, at);
      setCounts((current) =>
        current.above === above.length && current.below === below.length
          ? current
          : { above: above.length, below: below.length },
      );
    };
    update(scroll.get());
    return scroll.on('change', update);
  }, [scroll, tops, cardHeight, view]);

  const scrollTo = (target: number) =>
    animate(scroll, Math.max(0, Math.min(max, target)), { type: 'spring', stiffness: 220, damping: 30 });
  const scrollUp = () => {
    const { above } = outOfView(tops, cardHeight, view, scroll.get());
    if (above.length > 0) scrollTo(Math.max(...above) + cardHeight + MARGIN - view);
  };
  const scrollDown = () => {
    const { below } = outOfView(tops, cardHeight, view, scroll.get());
    if (below.length > 0) scrollTo(Math.min(...below) - MARGIN);
  };

  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  return (
    <div className={className} style={style}>
      <AnimatePresence>
        {counts.above > 0 && (
          <motion.button
            key="above"
            type="button"
            aria-label="Scroll pack up"
            onClick={scrollUp}
            className={PILL}
            style={{ top: topInset + MARGIN, x: '-50%' }}
            {...fade}
          >
            <ChevronUpIcon size={12} />
            {counts.above}
          </motion.button>
        )}
        {counts.below > 0 && (
          <motion.button
            key="below"
            type="button"
            aria-label="Scroll pack down"
            onClick={scrollDown}
            className={PILL}
            style={{ bottom: MARGIN, x: '-50%' }}
            {...fade}
          >
            <ChevronDownIcon size={12} />
            {counts.below}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HiddenCards;
