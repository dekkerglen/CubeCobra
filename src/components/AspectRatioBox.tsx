import React, { HTMLAttributes } from 'react';
import classNames from 'classnames';

export interface AspectRatioBoxProps extends HTMLAttributes<HTMLDivElement> {
  ratio: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const AspectRatioBox: React.FC<AspectRatioBoxProps> = ({ ratio, children, className = '', style = {} }) => {
  return (
    <div className="object-cover relative w-full" style={{ paddingTop: `${(100 / ratio).toFixed(5)}%` }}>
      <div className={classNames('absolute inset-0 overflow-hidden flex flex-col', className)} style={{ ...style }}>
        {children}
      </div>
    </div>
  );
};

export default AspectRatioBox;
