import React, { useMemo } from 'react';

import { ArrowRightIcon, ArrowSwitchIcon, NoEntryIcon, PlusCircleIcon, ToolsIcon } from '@primer/octicons-react';
import { cardName } from '@utils/cardutil';
import Card, {
  BoardChanges,
  CardDetails,
  Changes,
  CubeCardEdit,
  CubeCardRemove,
  CubeCardSwap,
} from '@utils/datatypes/Card';

import withAutocard from 'components/WithAutocard';
import { useCardDetails } from 'hooks/useCardDetails';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

import { Flexbox } from '../base/Layout';
import Link from '../base/Link';
import Text from '../base/Text';

export interface AddProps {
  card: Card;
}

const TextAutocard = withAutocard(Link);

const capitalizeFirstLetter = (string: string): string => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const Add: React.FC<AddProps> = ({ card }) => {
  return (
    <li>
      <span className="mx-1" style={{ color: 'green' }}>
        <PlusCircleIcon />
      </span>
      <TextAutocard href={`/tool/card/${card.cardID}`} card={card}>
        {cardName(card)}
      </TextAutocard>
    </li>
  );
};

export interface RemoveProps {
  oldCard: Card;
}

const Remove: React.FC<RemoveProps> = ({ oldCard }) => (
  <li>
    <span className="mx-1" style={{ color: 'red' }}>
      <NoEntryIcon />
    </span>
    <TextAutocard href={`/tool/card/${oldCard.cardID}`} card={oldCard}>
      {cardName(oldCard)}
    </TextAutocard>
  </li>
);

export interface EditProps {
  card: Card;
}

const Edit: React.FC<EditProps> = ({ card }) => (
  <li>
    <span className="mx-1" style={{ color: 'orange' }}>
      <ToolsIcon />
    </span>
    <TextAutocard href={`/tool/card/${card.cardID}`} card={card}>
      {cardName(card)}
    </TextAutocard>
  </li>
);

export interface SwapProps {
  oldCard: Card;
  card: Card;
}

const Swap: React.FC<SwapProps> = ({ oldCard, card }) => {
  return (
    <li>
      <span className="mx-1" style={{ color: 'blue' }}>
        <ArrowSwitchIcon />
      </span>
      <TextAutocard href={`/tool/card/${oldCard.cardID}`} card={oldCard}>
        {cardName(oldCard)}
      </TextAutocard>
      <ArrowRightIcon className="mx-1" />
      <TextAutocard href={`/tool/card/${card.cardID}`} card={card}>
        {cardName(card)}
      </TextAutocard>
    </li>
  );
};

export interface BlogPostChangelogProps {
  changelog: Changes;
}

// Server sends changelogs without card.details to keep response sizes down
// (see ChangelogDynamoDao.sanitizeChangelog). Resolve every cardID once
// through the IndexedDB cache, then build hydrated copies of the changes
// for the child components — they read card.details.name etc.
const collectCardIDs = (changelog: Changes): string[] => {
  const set = new Set<string>();
  for (const [key, value] of Object.entries(changelog)) {
    if (key === 'version' || !value || typeof value !== 'object') continue;
    const boardChanges = value as BoardChanges;
    for (const c of boardChanges.adds || []) if (c?.cardID) set.add(c.cardID);
    for (const r of boardChanges.removes || []) if (r?.oldCard?.cardID) set.add(r.oldCard.cardID);
    for (const s of boardChanges.swaps || []) {
      if (s?.oldCard?.cardID) set.add(s.oldCard.cardID);
      if (s?.card?.cardID) set.add(s.card.cardID);
    }
    for (const e of boardChanges.edits || []) {
      if (e?.oldCard?.cardID) set.add(e.oldCard.cardID);
      if (e?.newCard?.cardID) set.add(e.newCard.cardID);
    }
  }
  return [...set];
};

const withDetails = (card: Card | undefined, detailsById: Record<string, CardDetails | null>): Card => {
  if (!card) return card as any;
  if (card.details) return card;
  const details = (card.cardID && detailsById[card.cardID]) || getPlaceholderCardDetails(card?.cardID || '');
  return { ...card, details };
};

const BlogPostChangelog: React.FC<BlogPostChangelogProps> = ({ changelog }) => {
  const cardIDs = useMemo(() => (changelog ? collectCardIDs(changelog) : []), [changelog]);
  const { details: detailsById } = useCardDetails(cardIDs);

  if (!changelog || typeof changelog !== 'object') {
    return null;
  }

  return (
    <div>
      {Object.entries(changelog)
        .filter(([_, value]) => value && typeof value === 'object')
        .map(([board, boardChanges]) => {
          const typedChanges = boardChanges as BoardChanges;
          const { adds, removes, swaps, edits } = typedChanges;
          if (
            (!adds || adds.length === 0) &&
            (!removes || removes.length === 0) &&
            (!swaps || swaps.length === 0) &&
            (!edits || edits.length === 0)
          ) {
            return false;
          }
          return (
            <div key={board} className="mb-2">
              <Flexbox direction="row" justify="between">
                <Text md semibold>
                  {capitalizeFirstLetter(board)} Changelist
                </Text>
                <Text sm semibold className="text-text-secondary">
                  +{(adds || []).length + (swaps || []).length}, -{(removes || []).length + (swaps || []).length}
                  {(edits || []).length > 0 && (
                    <>
                      , <ToolsIcon size={12} />
                      {(edits || []).length}
                    </>
                  )}
                </Text>
              </Flexbox>
              <ul className="changelist">
                {adds && adds.map((card: Card) => <Add key={card.cardID} card={withDetails(card, detailsById)} />)}
                {removes &&
                  removes.map((remove: CubeCardRemove) => (
                    <Remove key={remove.oldCard.cardID} oldCard={withDetails(remove.oldCard, detailsById)} />
                  ))}
                {swaps &&
                  swaps.map((swap: CubeCardSwap) => (
                    <Swap
                      key={`${swap.oldCard.cardID}->${swap.card.cardID}`}
                      oldCard={withDetails(swap.oldCard, detailsById)}
                      card={withDetails(swap.card, detailsById)}
                    />
                  ))}
                {edits &&
                  edits.map((edit: CubeCardEdit) => (
                    <Edit key={edit.oldCard.cardID} card={withDetails(edit.newCard, detailsById)} />
                  ))}
              </ul>
            </div>
          );
        })}
    </div>
  );
};

export default BlogPostChangelog;
