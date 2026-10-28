import React from 'react';

import { PersonIcon } from '@primer/octicons-react';
import { cdnUrl } from '@utils/cdnUrl';
import Draft, { REVERSE_TYPES } from '@utils/datatypes/Draft';
import User from '@utils/datatypes/User';

import AspectRatioBox from './base/AspectRatioBox';
import Datetime from './base/Datetime';
import Text from './base/Text';

const COLOR_LABELS: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
};

const parseLeadingColors = (name: string): { colors: string[]; rest: string } => {
  const match = name.match(/^([WUBRGC]+)\s+(.+)$/);
  if (!match) {
    return { colors: [], rest: name };
  }
  const raw = match[1]!.toUpperCase();
  const unique = Array.from(new Set(raw.split('')));
  const isColorless = unique.length === 1 && unique[0] === 'C';
  const isColored = unique.length === raw.length && unique.every((c) => 'WUBRG'.includes(c));
  if (!isColorless && !isColored) {
    return { colors: [], rest: name };
  }
  return { colors: unique, rest: match[2]! };
};

interface DeckPreviewProps {
  deck: Draft;
}

const DeckPreview: React.FC<DeckPreviewProps> = ({ deck }) => {
  const seatCount = deck.seatNames?.length ?? deck.seats?.length ?? 0;
  const owner = typeof deck.owner === 'object' ? (deck.owner as User).username : deck.owner;
  const typeLabel = REVERSE_TYPES[deck.type] ?? 'Draft';
  const { colors, rest: displayName } = parseLeadingColors(deck.name);

  return (
    <div className="p-2">
      <a
        href={`/cube/deck/${deck.id}`}
        className="group block bg-bg-accent/80 shadow border border-border hover:border-border-active overflow-hidden rounded-lg"
      >
        <AspectRatioBox ratio={16 / 9}>
          <img
            src={deck.previewImage || `/cubeimage/${deck.cube}`}
            alt={deck.name}
            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105 saturate-75"
          />

          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xxs font-semibold uppercase tracking-wider bg-emerald-700/90 text-white backdrop-blur-sm">
              {typeLabel}
            </span>
          </div>

          {colors.length > 0 && (
            <div className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm">
              {colors.map((c) => (
                <img
                  key={c}
                  src={cdnUrl(`/content/symbols/${c.toLowerCase()}.png`)}
                  alt={COLOR_LABELS[c] ?? c}
                  title={COLOR_LABELS[c] ?? c}
                  className="w-6 h-6"
                />
              ))}
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-1 bg-black/40 backdrop-blur-sm">
            <Text bold xl className="text-white truncate leading-tight">
              {displayName}
            </Text>
            <div className="flex items-end justify-between gap-3 min-w-0">
              {owner ? (
                <Text bold lg className="text-white/95 truncate leading-tight min-w-0">
                  by {owner}
                </Text>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2 shrink-0 text-white/80">
                <Text xs className="text-white/70 whitespace-nowrap">
                  <Datetime date={deck.date} />
                </Text>
                <span className="inline-flex items-center gap-1">
                  <PersonIcon size={12} />
                  <Text xs className="text-white/90">
                    {seatCount}
                  </Text>
                </span>
              </div>
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

export default DeckPreview;
