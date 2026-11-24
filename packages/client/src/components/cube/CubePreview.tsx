import React from 'react';

import { HeartFillIcon, PinIcon, PinSlashIcon, StackIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import { getCubeId } from '@utils/Util';

import usePinToggle from '../../hooks/usePinToggle';
import AspectRatioBox from '../base/AspectRatioBox';
import Text from '../base/Text';
import PinnedMarker from './PinnedMarker';

interface CubePreviewProps {
  cube: Cube;
  // Opt-in, so only lists that sort pinned cubes first explain that ordering with the marker.
  markPinned?: boolean;
  // Your own profile: the marker plus a button to pin or unpin. Implies `markPinned`.
  pinToggle?: boolean;
}

const CubePreview: React.FC<CubePreviewProps> = ({ cube, markPinned = false, pinToggle = false }) => {
  const pin = usePinToggle(cube.id, !!cube.pinnedByCurrentUser);
  const pinned = pinToggle ? pin.pinned : markPinned && !!cube.pinnedByCurrentUser;
  const followers = cube.likeCount ?? 0;

  const categories = [
    ...(cube.categoryPrefixes || []),
    ...(cube.categoryOverride ? [cube.categoryOverride] : []),
  ].slice(0, 5);

  return (
    <div className="relative p-2">
      <a
        href={`/cube/list/${getCubeId(cube)}`}
        aria-label={pinned ? `${cube.name}, pinned` : undefined}
        className="group block bg-bg-accent/80 shadow border border-border hover:border-border-active overflow-hidden rounded-lg"
      >
        <AspectRatioBox ratio={16 / 9}>
          <img
            src={cube.image.uri}
            alt={cube.name}
            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />

          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none" />

          <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-1.5">
            <Text bold xl className="text-white line-clamp-2 leading-tight text-shadow">
              {cube.name}
            </Text>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {categories.map((cat, i) => (
                  <span
                    key={`${cat}-${i}`}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xxs font-semibold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 text-white/90 min-w-0">
              <span className="inline-flex items-center gap-1">
                <HeartFillIcon size={12} />
                <Text xs className="text-white/90">
                  {followers}
                </Text>
              </span>
              <span className="inline-flex items-center gap-1">
                <StackIcon size={12} />
                <Text xs className="text-white/90">
                  {cube.cardCount}
                </Text>
              </span>
              {pinned && <PinnedMarker />}
              <Text xs className="text-white/80 truncate">
                by {cube.owner.username}
              </Text>
            </div>
          </div>

          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ boxShadow: 'inset 0 0 12px 1px rgba(255, 255, 255, 0.85)' }}
          />
        </AspectRatioBox>
      </a>
      {pinToggle && (
        // A sibling of the link rather than inside it: interactive content nested in a link is invalid.
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            pin.toggle();
          }}
          aria-label={pin.label}
          title={pin.label}
          className="absolute top-4 right-4 flex items-center justify-center p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {pin.pinned ? <PinSlashIcon size={16} /> : <PinIcon size={16} />}
        </button>
      )}
    </div>
  );
};

export default CubePreview;
