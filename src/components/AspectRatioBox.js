import React from 'react';

const AspectRatioBox = ({ ratio, className, ...props }) => (
  <div className="position-relative w-100" style={{ paddingTop: `${(100 / ratio).toFixed(5)}%` }}>
    <div className={'position-absolute' + (className ? '' : ` ${className}`)} style={{ left: 0, top: 0, right: 0, bottom: 0 }} {...props} />
  </div>
);

export default AspectRatioBox;