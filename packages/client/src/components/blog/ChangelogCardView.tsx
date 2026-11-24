import React, { useContext, useMemo } from 'react';

import { ToolsIcon } from '@primer/octicons-react';
import { CardDetails, Changes } from '@utils/datatypes/Card';
import { GridTightnessPreference } from '@utils/datatypes/User';

import { useCardDetails } from 'hooks/useCardDetails';
import {
  ChangeKind,
  ChangelogCardEntry,
  ChangelogSwapPair,
  changelogToBoardRows,
  collectChangelogCardIDs,
  withDetails,
} from 'utils/changelogCards';

import UserContext from '../../contexts/UserContext';
import CardGrid, { CardGridBadge } from '../card/CardGrid';
import { Col, Flexbox, NumCols, Row } from '../base/Layout';
import Text from '../base/Text';
import SwapStackTile from './SwapStackTile';

// Hidden below md: on phone-sized cards the badges cover the art.
const BADGES: Record<ChangeKind, CardGridBadge> = {
  add: { label: '+', title: 'Added', className: 'hidden md:block bg-green-600/90' },
  remove: { label: '−', title: 'Removed', className: 'hidden md:block bg-red-600/90' },
  edit: { label: '✎', title: 'Edited', className: 'hidden md:block bg-orange-500/90' },
};

const capitalizeFirstLetter = (string: string): string => string.charAt(0).toUpperCase() + string.slice(1);

interface ChangelogCardRowProps {
  label: string;
  entries: ChangelogCardEntry[];
  cardsPerRow: NumCols;
  detailsById: Record<string, CardDetails | null>;
}

const ChangelogCardRow: React.FC<ChangelogCardRowProps> = ({ label, entries, cardsPerRow, detailsById }) => {
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <Text sm semibold className="text-text-secondary">
        {label} ({entries.length})
      </Text>
      <CardGrid
        cards={entries.map((entry) => withDetails(entry.card, detailsById))}
        xs={cardsPerRow}
        badges={entries.map((entry) => BADGES[entry.kind])}
        hrefFn={(card) => `/tool/card/${card.cardID}`}
      />
    </div>
  );
};

interface ChangelogSwapRowProps {
  pairs: ChangelogSwapPair[];
  cardsPerRow: NumCols;
  detailsById: Record<string, CardDetails | null>;
}

const ChangelogSwapRow: React.FC<ChangelogSwapRowProps> = ({ pairs, cardsPerRow, detailsById }) => {
  const user = useContext(UserContext);

  if (pairs.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <Text sm semibold className="text-text-secondary">
        Swapped ({pairs.length})
      </Text>
      <Row xs={cardsPerRow} gutters={user?.gridTightness === GridTightnessPreference.TIGHT ? 0 : 2}>
        {pairs.map((pair, i) => (
          <Col key={i} xs={1}>
            <SwapStackTile
              oldCard={withDetails(pair.oldCard, detailsById)}
              card={withDetails(pair.card, detailsById)}
            />
          </Col>
        ))}
      </Row>
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

  const rowProps = { cardsPerRow, detailsById };

  return (
    <div className="flex flex-col gap-4">
      {boards.map(({ board, added, removed, swapped, edited, addCount, removeCount, editCount }) => (
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
          <ChangelogCardRow label="Removed" entries={removed} {...rowProps} />
          <ChangelogSwapRow pairs={swapped} {...rowProps} />
          <ChangelogCardRow label="Edited" entries={edited} {...rowProps} />
        </div>
      ))}
    </div>
  );
};

export default ChangelogCardView;
