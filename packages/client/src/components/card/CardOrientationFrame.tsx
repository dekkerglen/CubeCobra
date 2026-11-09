import React, { forwardRef } from 'react';

import { CardOrientation } from '@utils/cardutil';
import classNames from 'classnames';

export interface CardOrientationFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation: CardOrientation;
  // CSS width of the frame. For a landscape frame this is the width of the *rotated*
  // card, so the box it reserves is `width` by `width * 488/680`.
  width?: string;
  children: React.ReactNode;
}

// A card image is always 488x680 portrait, even for cards that are printed sideways —
// Scryfall rotates the artwork inside the portrait frame rather than shipping a
// landscape asset. Turning one the right way up means rotating it ourselves, which is
// what this does.
//
// The rotation is a transform, and a transform does not change layout size, so a rotated
// image alone would leave its parent still measuring 488x680. The outer div therefore
// carries the landscape box explicitly: the autocard popup measures itself to clamp into
// the viewport, and would otherwise clamp against the wrong width.
//
// 488/680 = 71.7647%: the inner box's width is the outer box's *height*, so rotating it a
// quarter turn lands it exactly on the outer box.
const INNER_WIDTH = '71.7647%';

const CardOrientationFrame = forwardRef<HTMLDivElement, CardOrientationFrameProps>(
  ({ orientation, width = '100%', className, children, ...props }, ref) => {
    if (orientation === 'portrait') {
      return (
        <div ref={ref} className={className} style={{ width }} {...props}>
          {children}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={classNames('relative overflow-hidden', className)}
        style={{ width, aspectRatio: '680 / 488' }}
        {...props}
      >
        {/* Children keep their own classes: `card-border`'s percentage radii have to stay
            on the image, where they resolve against its still-portrait box. */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90"
          style={{ width: INNER_WIDTH, aspectRatio: '488 / 680' }}
        >
          {children}
        </div>
      </div>
    );
  },
);

CardOrientationFrame.displayName = 'CardOrientationFrame';

export default CardOrientationFrame;
