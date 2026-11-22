import React, { useMemo, useState } from 'react';

import { ToolsIcon } from '@primer/octicons-react';
import { CardDetails, Changes } from '@utils/datatypes/Card';

import { useCardDetails } from 'hooks/useCardDetails';
import {
  ChangeKind,
  ChangelogCardEntry,
  changelogToBoardRows,
  collectChangelogCardIDs,
  withDetails,
} from 'utils/changelogCards';

import CardGrid, { CardGridBadge } from '../card/CardGrid';
import { Flexbox, NumCols } from '../base/Layout';
import Text from '../base/Text';

const BADGES: Record<ChangeKind, CardGridBadge> = {
  add: { label: '+', title: 'Added', className: 'bg-green-600/90' },
  remove: { label: '−', title: 'Removed', className: 'bg-red-600/90' },
  swap: { label: '⇄', title: 'Swapped', className: 'bg-blue-600/90' },
  edit: { label: '✎', title: 'Edited', className: 'bg-orange-500/90' },
};

const capitalizeFirstLetter = (string: string): string => string.charAt(0).toUpperCase() + string.slice(1);

interface ChangelogCardRowProps {
  label: string;
  entries: ChangelogCardEntry[];
  cardsPerRow: NumCols;
  detailsById: Record<string, CardDetails | null>;
  hoveredSwapId: string | null;
  setHoveredSwapId: (swapId: string | null) => void;
  grayscale?: boolean;
}

const ChangelogCardRow: React.FC<ChangelogCardRowProps> = ({
  label,
  entries,
  cardsPerRow,
  detailsById,
  hoveredSwapId,
  setHoveredSwapId,
  grayscale = false,
}) => {
  if (entries.length === 0) return null;

  const ringedIndices = hoveredSwapId ? entries.flatMap((entry, i) => (entry.swapId === hoveredSwapId ? [i] : [])) : [];

  return (
    <div className="flex flex-col gap-1">
      <Text sm semibold className="text-text-secondary">
        {label} ({entries.length})
      </Text>
      <CardGrid
        cards={entries.map((entry) => withDetails(entry.card, detailsById))}
        xs={cardsPerRow}
        badges={entries.map((entry) => BADGES[entry.kind])}
        ringedIndices={ringedIndices}
        onCardHover={(i) => setHoveredSwapId(i === null ? null : (entries[i]?.swapId ?? null))}
        cardProps={grayscale ? { className: 'grayscale' } : undefined}
      />
    </div>
  );
};

export interface ChangelogCardViewProps {
  changelog: Changes;
  cardsPerRow: NumCols;
}

const ChangelogCardView: React.FC<ChangelogCardViewProps> = ({ changelog, cardsPerRow }) => {
  const cardIDs = useMemo(() => (changelog ? collectChangelogCardIDs(changelog) : []), [changelog]);
  const { details: detailsById } = useCardDetails(cardIDs);
  const boards = useMemo(() => (changelog ? changelogToBoardRows(changelog) : []), [changelog]);
  const [hoveredSwapId, setHoveredSwapId] = useState<string | null>(null);

  const rowProps = { cardsPerRow, detailsById, hoveredSwapId, setHoveredSwapId };

  return (
    <div className="flex flex-col gap-4">
      {boards.map(({ board, added, removed, edited, addCount, removeCount, editCount }) => (
        <div key={board} className="flex flex-col gap-2">
          <Flexbox direction="row" justify="between" className="border-b border-border">
            <Text md semibold>
              {capitalizeFirstLetter(board)}
            </Text>
            <Text sm semibold className="text-text-secondary">
              +{addCount}, -{removeCount}
              {editCount > 0 && (
                <>
                  , <ToolsIcon size={12} />
                  {editCount}
                </>
              )}
            </Text>
          </Flexbox>
          <ChangelogCardRow label="Added" entries={added} {...rowProps} />
          <ChangelogCardRow label="Removed" entries={removed} grayscale {...rowProps} />
          <ChangelogCardRow label="Edited" entries={edited} {...rowProps} />
        </div>
      ))}
    </div>
  );
};

export default ChangelogCardView;
