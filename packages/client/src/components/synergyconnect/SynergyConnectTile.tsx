import React from 'react';

import { SynergyConnectCard } from '@utils/datatypes/SynergyConnect';
import classNames from 'classnames';

import { GROUP_BORDERS } from 'components/synergyconnect/groupStyles';
import withAutocard from 'components/WithAutocard';

// Tiles are small so the whole board fits on screen; hovering shows the card
// at full size so it stays readable.
const AutocardButton = withAutocard('button');

export interface SynergyConnectTileProps {
  card: SynergyConnectCard;
  selected: boolean;
  // Group index once this card's group has been found, otherwise null.
  solvedGroupIndex: number | null;
  disabled?: boolean;
  shake?: boolean;
  onClick: () => void;
}

/** One of the sixteen board tiles: the actual card. */
const SynergyConnectTile: React.FC<SynergyConnectTileProps> = ({
  card,
  selected,
  solvedGroupIndex,
  disabled,
  shake,
  onClick,
}) => {
  const solved = solvedGroupIndex !== null;
  const imageUrl = `/tool/cardimage/${encodeURIComponent(card.oracleId)}`;

  return (
    <AutocardButton
      type="button"
      image={imageUrl}
      // NOT `disabled`: a disabled button fires no mouse events, which would
      // kill the autocard preview on solved cards and after the game ends.
      onClick={() => {
        if (!disabled && !solved) {
          onClick();
        }
      }}
      aria-disabled={disabled || solved}
      aria-pressed={selected}
      aria-label={card.name}
      className={classNames('relative block w-full rounded-lg', {
        'synergy-shake': shake,
        'cursor-pointer': !disabled && !solved,
      })}
    >
      <img
        // Accepts an oracle id and redirects to the card's default printing.
        src={imageUrl}
        alt={card.name}
        loading="lazy"
        className={classNames(
          'block aspect-[63/88] w-full rounded-lg border-4 object-cover transition-all duration-300',
          {
            'animate-pulse border-link': selected,
            'border-transparent hover:opacity-70': !selected && !solved,
            [`opacity-60 ${GROUP_BORDERS[solvedGroupIndex! % GROUP_BORDERS.length]}`]: solved,
          },
        )}
      />
    </AutocardButton>
  );
};

export default SynergyConnectTile;
