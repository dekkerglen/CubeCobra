import React, { useState } from 'react';

interface TooltipProps {
  text: string;
  wrapperTag?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ text, wrapperTag: WrapperTag = 'div', className, style, children }) => {
  const [visible, setVisible] = useState(false);

  return (
    <WrapperTag
      className={`relative inline-block ${className}`}
      style={style}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full mb-2 w-max px-2 py-1 text-sm text-white bg-black rounded shadow-lg">
          {text}
        </div>
      )}
    </WrapperTag>
  );
};

export default Tooltip;
