import React, { ReactNode, useRef } from 'react';
import { UncontrolledTooltip, UncontrolledTooltipProps } from 'reactstrap';

interface TooltipProps {
  text: string;
  children: ReactNode;
  wrapperTag?: React.ElementType;
  tooltipProps?: UncontrolledTooltipProps;
}

const Tooltip: React.FC<TooltipProps> = ({
  text,
  children,
  wrapperTag: WrapperTag = 'div',
  tooltipProps = {},
  ...props
}) => {
  const divRef = useRef<HTMLElement>(null);

  return (
    <>
      <WrapperTag ref={divRef} {...props}>
        {children}
      </WrapperTag>
      {divRef.current && (
        <UncontrolledTooltip
          placement="top"
          boundariesElement="window"
          trigger="hover"
          {...tooltipProps}
          target={divRef.current}
        >
          {text}
        </UncontrolledTooltip>
      )}
    </>
  );
};

export default Tooltip;
