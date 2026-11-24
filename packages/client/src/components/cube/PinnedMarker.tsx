import React from 'react';

import { PinIcon } from '@primer/octicons-react';

// Rendered after a pinned cube's name. Decoration only: the row's link carries ", pinned" in its
// accessible name. Persistent rather than hover-only, since it explains why pinned cubes sort first
// and touch has no hover. `flex items-center` keeps the inline svg off the text baseline.
export default function PinnedMarker(): React.JSX.Element {
  return (
    <span aria-hidden className="flex flex-shrink-0 items-center text-text-secondary">
      <PinIcon size={12} />
    </span>
  );
}
