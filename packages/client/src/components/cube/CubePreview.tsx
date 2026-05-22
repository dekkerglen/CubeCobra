import React from 'react';

import { HeartFillIcon, StackIcon } from '@primer/octicons-react';
import Cube from '@utils/datatypes/Cube';
import { getCubeId } from '@utils/Util';

import AspectRatioBox from '../base/AspectRatioBox';
import Text from '../base/Text';

interface CubePreviewProps {
  cube: Cube;
}

const CubePreview: React.FC<CubePreviewProps> = ({ cube }) => {
  const followers = cube.likeCount ?? 0;

  const categories = [
    ...(cube.categoryPrefixes || []),
    ...(cube.categoryOverride ? [cube.categoryOverride] : []),
  ].slice(0, 5);

  return (
    <div className="p-2">
      <a
        href={`/cube/list/${getCubeId(cube)}`}
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
    </div>
  );
};

export default CubePreview;
