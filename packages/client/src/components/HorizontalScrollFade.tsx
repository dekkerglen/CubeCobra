import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

import classNames from 'classnames';

interface HorizontalScrollFadeProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A sideways-scrolling strip whose left and right edges fade out while there's
 * more content in that direction.
 */
const HorizontalScrollFade: React.FC<HorizontalScrollFadeProps> = ({ children, className }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  // Re-check when the strip or its content resizes (e.g. as card images load).
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [update]);

  return (
    <div className={classNames('relative', className)}>
      <div ref={scrollerRef} onScroll={update} className="overflow-x-auto no-scrollbar">
        {children}
      </div>
      <div
        className={classNames(
          'pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg-accent to-transparent transition-opacity',
          edges.left ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={classNames(
          'pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg-accent to-transparent transition-opacity',
          edges.right ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
};

export default HorizontalScrollFade;
