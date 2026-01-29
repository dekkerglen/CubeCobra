import React, { useCallback, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  wrapperTag?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

const Tooltip: React.FC<TooltipProps> = ({
  text,
  wrapperTag = 'div',
  className,
  style,
  children,
  position = 'top',
}) => {
  const [visible, setVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, alignRight: false });
  const wrapperRef = useRef<HTMLElement>(null);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      setVisible(true);

      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const isRightSide = e.clientX > window.innerWidth / 2;

        setTooltipPosition({
          top: position === 'top' ? rect.top - 8 : rect.bottom + 8,
          left: isRightSide ? rect.right : rect.left,
          alignRight: isRightSide,
        });
      }
    },
    [position],
  );

  const WrapperTag = wrapperTag as React.ElementType;

  const tooltipContent = visible && (
    <div
      className="fixed z-50 w-max max-w-xs px-2 py-1 text-sm text-white bg-black rounded shadow-lg pointer-events-none"
      style={{
        top: `${tooltipPosition.top}px`,
        left: tooltipPosition.alignRight ? 'auto' : `${tooltipPosition.left}px`,
        right: tooltipPosition.alignRight ? `${window.innerWidth - tooltipPosition.left}px` : 'auto',
        transform: position === 'top' ? 'translateY(-100%)' : 'translateY(0)',
      }}
    >
      {text}
    </div>
  );

  return (
    <>
      <WrapperTag
        ref={wrapperRef}
        className={`relative inline-block ${className}`}
        style={style}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </WrapperTag>
      {typeof document !== 'undefined' && createPortal(tooltipContent, document.body)}
    </>
  );
};

export default Tooltip;
