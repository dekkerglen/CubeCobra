import React from 'react';

import { ArrowRightIcon, ArrowSwitchIcon, NoEntryIcon, PlusCircleIcon, ToolsIcon } from '@primer/octicons-react';

import withAutocard from 'components/WithAutocard';
import Card, { BoardType } from 'datatypes/Card';
import { Flexbox } from './base/Layout';
import Text from './base/Text';
import Link from './base/Link';

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
        {card.details?.name}
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
      {oldCard.details?.name}
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
      {card.details?.name}
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
        {oldCard.details?.name}
      </TextAutocard>
      <ArrowRightIcon className="mx-1" />
      <TextAutocard href={`/tool/card/${card.cardID}`} card={card}>
        {card.details?.name}
      </TextAutocard>
    </li>
  );
};

export interface BlogPostChangelogProps {
  changelog: {
    [key in BoardType]?: {
      adds?: Card[];
      removes?: { oldCard: Card }[];
      swaps?: { oldCard: Card; card: Card }[];
      edits?: { oldCard: Card }[];
    };
  };
}

const BlogPostChangelog: React.FC<BlogPostChangelogProps> = ({ changelog }) => {
  return (
    <div>
      {Object.entries(changelog).map(([board, { adds, removes, swaps, edits }]) => {
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
              {adds && adds.map((card) => <Add key={card.cardID} card={card} />)}
              {removes && removes.map((remove) => <Remove key={remove.oldCard.cardID} oldCard={remove.oldCard} />)}
              {swaps &&
                swaps.map((swap) => (
                  <Swap key={`${swap.oldCard.cardID}->${swap.card.cardID}`} oldCard={swap.oldCard} card={swap.card} />
                ))}
              {edits && edits.map((edit) => <Edit key={edit.oldCard.cardID} card={edit.oldCard} />)}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default BlogPostChangelog;
