import React from 'react';

import { EyeClosedIcon } from '@primer/octicons-react';

import Text from 'components/base/Text';

// A placeholder for a card whose identity is hidden from the viewer (an opponent's card
// that has never been face-up in a shared pool). Uses the MTG card aspect ratio so it lines
// up with real card images. We deliberately don't render an actual card back (that artwork
// is Wizards of the Coast IP).
const CardBack: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`flex aspect-[63/88] w-full flex-col items-center justify-center gap-1 rounded-md border border-border bg-bg-accent text-text-secondary ${className ?? ''}`}
  >
    <EyeClosedIcon size={20} />
    <Text sm>Hidden</Text>
  </div>
);

export default CardBack;
