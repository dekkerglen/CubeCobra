import React, { HTMLAttributes } from 'react';

import cx from 'classnames';

export interface AspectRatioBoxProps extends HTMLAttributes<HTMLDivElement> {
  ratio: number;
  className?: string;
  style?: React.CSSProperties;
}

const AspectRatioBox: React.FC<AspectRatioBoxProps> = ({ ratio, className = '', style = {}, ...props }) => (
  <div className="position-relative w-100" style={{ paddingTop: `${(100 / ratio).toFixed(5)}%` }}>
    <div
      className={cx('position-absolute', 'overflow-hidden', className)}
      style={{ ...style, left: 0, top: 0, right: 0, bottom: 0 }}
      {...props}
    />
  </div>
);

export default AspectRatioBox;
