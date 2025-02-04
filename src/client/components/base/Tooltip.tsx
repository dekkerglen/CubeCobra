import React, { useState } from 'react';

interface TooltipProps {
  text: string;
  wrapperTag?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

const Tooltip: React.FC<TooltipProps> = ({
  text,
  wrapperTag: WrapperTag = 'div',
  className,
  style,
  children,
  position = 'top',
}) => {
  const [visible, setVisible] = useState(false);

  const tooltipPositionClasses = position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <WrapperTag
      className={`relative inline-block ${className}`}
      style={style}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`absolute ${tooltipPositionClasses} w-max px-2 py-1 text-sm text-white bg-black rounded shadow-lg`}
        >
          {text}
        </div>
      )}
    </WrapperTag>
  );
};

export default Tooltip;
