import React, { useCallback, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

interface ScrollShadowContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A container that shows an inlay shadow at the bottom when content overflows,
 * indicating to users they can scroll. Hides the scrollbar for a cleaner look.
 */
const ScrollShadowContainer: React.FC<ScrollShadowContainerProps> = ({ children, className, style }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  const checkScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isScrolledToBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px threshold
    const hasOverflow = scrollHeight > clientHeight;

    setShowBottomShadow(hasOverflow && !isScrolledToBottom);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check on mount and content changes
    checkScroll();

    // Create a ResizeObserver to detect content size changes
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(container);

    // Listen to scroll events
    container.addEventListener('scroll', checkScroll);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', checkScroll);
    };
  }, [checkScroll]);

  return (
    <div className="relative w-full h-full" style={style}>
      <div
        ref={containerRef}
        className={classNames('overflow-y-auto overflow-x-hidden no-scrollbar h-full', className)}
      >
        {children}
      </div>
      {/* Bottom shadow overlay */}
      {showBottomShadow && (
        <div
          className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none bg-gradient-to-t from-bg-accent to-transparent"
          style={{
            boxShadow: 'inset 0 -12px 16px -8px rgba(0, 0, 0, 0.4)',
          }}
        />
      )}
    </div>
  );
};

export default ScrollShadowContainer;
