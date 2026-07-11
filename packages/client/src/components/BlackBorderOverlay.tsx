import React from 'react';

/**
 * Foil versions of white-bordered cards actually print with a black border, but Scryfall serves
 * the white-bordered image. This overlays a black frame sized to the standard card border so those
 * cards render correctly.
 *
 * The geometry was measured from Scryfall's card images (viewBox is the card in mm): the outer
 * corner radius matches the `card-border` CSS rounding, and the frame is slightly thicker top and
 * bottom than on the sides, matching the real border. `preserveAspectRatio="none"` stretches the
 * frame to fill whatever box the card image occupies. Positioning mirrors `.foilOverlay` so it lines
 * up with the card in every context the foil overlay already works in.
 */
const BlackBorderOverlay: React.FC = () => (
  <svg
    viewBox="0 0 63 88"
    preserveAspectRatio="none"
    style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
    aria-hidden="true"
  >
    <path
      fill="black"
      fillRule="evenodd"
      d="M2.97,0 h57.06 a2.97,2.97 0 0 1 2.97,2.97 v82.06 a2.97,2.97 0 0 1 -2.97,2.97 h-57.06 a2.97,2.97 0 0 1 -2.97,-2.97 v-82.06 a2.97,2.97 0 0 1 2.97,-2.97 z M4.13,3.37 h54.74 a1.03,1.03 0 0 1 1.03,1.03 v79.2 a1.03,1.03 0 0 1 -1.03,1.03 h-54.74 a1.03,1.03 0 0 1 -1.03,-1.03 v-79.2 a1.03,1.03 0 0 1 1.03,-1.03 z"
    />
  </svg>
);

export default BlackBorderOverlay;
