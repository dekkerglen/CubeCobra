import React from 'react';

import { ArrowRightIcon, ArrowSwitchIcon, NoEntryIcon, PlusCircleIcon, ToolsIcon } from '@primer/octicons-react';
import { cardName } from '@utils/cardutil';
import Card, { BoardChanges, Changes, CubeCardEdit, CubeCardRemove, CubeCardSwap } from '@utils/datatypes/Card';

import withAutocard from 'components/WithAutocard';

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

const BlogPostChangelog: React.FC<BlogPostChangelogProps> = ({ changelog }) => {
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
                </Text>
              </Flexbox>
              <ul className="changelist">
                {adds && adds.map((card: Card) => <Add key={card.cardID} card={card} />)}
                {removes &&
                  removes.map((remove: CubeCardRemove) => (
                    <Remove key={remove.oldCard.cardID} oldCard={remove.oldCard} />
                  ))}
                {swaps &&
                  swaps.map((swap: CubeCardSwap) => (
                    <Swap key={`${swap.oldCard.cardID}->${swap.card.cardID}`} oldCard={swap.oldCard} card={swap.card} />
                  ))}
                {edits && edits.map((edit: CubeCardEdit) => <Edit key={edit.oldCard.cardID} card={edit.newCard} />)}
              </ul>
            </div>
          );
        })}
    </div>
  );
};

export default BlogPostChangelog;
