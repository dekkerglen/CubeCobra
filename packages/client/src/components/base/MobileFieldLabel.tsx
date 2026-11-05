import React from 'react';

import ResponsiveDiv from './ResponsiveDiv';
import Text from './Text';

interface MobileFieldLabelProps {
  children: React.ReactNode;
}

/**
 * A field's name, shown only below `md`.
 *
 * Dense rows on this site are laid out as columns with one heading row above the list, which
 * reads well while the row is a single line. Below `md` those rows stack, and a heading that
 * is no longer over its column is a caption pointing at nothing — or, when the row is wide
 * enough, a heading pushed off the screen entirely. Pair this with headings wrapped in
 * `<ResponsiveDiv md>`: the headings name the columns where there are columns, and each field
 * names itself where there are not.
 *
 * Purely decorative — the control it sits above keeps its own accessible name, which is
 * usually more specific than a column can be ("Alice Wins" rather than "P1 Wins").
 */
const MobileFieldLabel: React.FC<MobileFieldLabelProps> = ({ children }) => (
  <ResponsiveDiv baseVisible md>
    <Text xs semibold className="text-text-secondary">
      {children}
    </Text>
  </ResponsiveDiv>
);

export default MobileFieldLabel;
